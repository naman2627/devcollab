import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import Message, { conversationKey } from '../models/Message.js';
import Notification from '../models/Notification.js';
import { COOKIE_NAME, userFromToken } from '../middleware/auth.js';

/**
 * Module-level singleton plus a presence map.
 *
 * WHY a Map<userId, Set<socketId>> and not Map<userId, socketId>: one person
 * routinely has the app open in several tabs, and on mobile a backgrounded
 * socket lingers while a new one connects. Storing a Set means every live tab
 * receives the message, and a disconnect only takes that user offline once the
 * LAST socket is gone.
 */
let io = null;
const online = new Map();

const addSocket = (userId, socketId) => {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
};

const removeSocket = (userId, socketId) => {
  const set = online.get(userId);
  if (!set) return;
  set.delete(socketId);
  // Drop the key entirely when the last tab closes, so `online` does not grow
  // into a map of empty Sets over the life of the process.
  if (set.size === 0) online.delete(userId);
};

/**
 * The ONLY way the rest of the app talks to sockets.
 *
 * WHY export a helper instead of a global `io`: controllers should not know
 * about rooms, socket ids, or whether the socket layer is even running. This
 * also makes the no-op case (seed script, smoke test, sockets not initialised)
 * harmless rather than a crash on `io.to(...)` of undefined.
 */
export const emitToUser = (userId, event, payload) => {
  if (!io) return;
  const sockets = online.get(String(userId));
  if (!sockets) return; // recipient is offline; the DB row is their inbox
  for (const id of sockets) io.to(id).emit(event, payload);
};

export const isOnline = (userId) => online.has(String(userId));

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    // No CORS block: the client is served from this same origin in production,
    // and Vite proxies /socket.io in development.
    path: '/socket.io',
  });

  /**
   * Authenticate during the handshake, before any event can be received.
   *
   * WHY in io.use and not per-event: an unauthenticated socket must never be
   * able to emit `message:send` at all. Checking once at connect time means no
   * handler below has to re-verify identity, and `socket.userId` can be
   * trusted everywhere. We read the same httpOnly cookie the REST API uses, so
   * there is one session and nothing to keep in sync.
   */
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers?.cookie;
      if (!raw) return next(new Error('unauthorized'));

      const token = parseCookie(raw)[COOKIE_NAME];
      const user = await userFromToken(token);
      if (!user) return next(new Error('unauthorized'));

      socket.userId = String(user._id);
      socket.username = user.username;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    addSocket(socket.userId, socket.id);

    /**
     * Send a direct message.
     *
     * WHY persist BEFORE emitting: if we emitted first and the write then
     * failed, the recipient would see a message that does not exist and which
     * vanishes on refresh. Writing first means the socket emit is only ever an
     * optimisation over the REST history - losing it costs a refresh, not data.
     */
    socket.on('message:send', async ({ to, text }, ack) => {
      try {
        const body = String(text || '').trim();
        if (!to || !body) return ack?.({ success: false, message: 'Message cannot be empty.' });
        if (String(to) === socket.userId) {
          return ack?.({ success: false, message: 'You cannot message yourself.' });
        }

        const message = await Message.create({
          conversation: conversationKey(socket.userId, to),
          sender: socket.userId,
          recipient: to,
          text: body.slice(0, 2000),
        });

        const payload = {
          _id: message._id,
          conversation: message.conversation,
          sender: socket.userId,
          recipient: String(to),
          text: message.text,
          read: false,
          createdAt: message.createdAt,
        };

        // Echo to the sender's own other tabs too, so a message typed on the
        // laptop appears in the phone's open thread.
        emitToUser(socket.userId, 'message:new', payload);
        emitToUser(to, 'message:new', payload);

        // A chat notification only makes sense if they are not already looking
        // at a live socket; otherwise the bell would buzz for every line.
        if (!isOnline(to)) {
          const note = await Notification.create({
            recipient: to,
            sender: socket.userId,
            type: 'message',
            text: `@${socket.username} sent you a message`,
          });
          emitToUser(to, 'notification:new', note);
        }

        // Acknowledgement callback: lets the client clear its optimistic
        // "sending" state and know the row is durable.
        return ack?.({ success: true, data: payload });
      } catch (err) {
        console.error('[socket] message:send failed', err.message);
        return ack?.({ success: false, message: 'Could not send that message.' });
      }
    });

    /**
     * Typing indicator - deliberately NOT persisted. It is worthless a second
     * later, so a DB write would be pure cost.
     */
    socket.on('typing', ({ to, typing }) => {
      if (!to) return;
      emitToUser(to, 'typing', { from: socket.userId, typing: Boolean(typing) });
    });

    socket.on('disconnect', () => {
      removeSocket(socket.userId, socket.id);
    });
  });

  console.log('[socket] ready');
  return io;
}

export default { initSockets, emitToUser, isOnline };
