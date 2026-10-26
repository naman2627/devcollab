import { create } from 'zustand';
import { io } from 'socket.io-client';
import api from '../api/client.js';

/**
 * Socket connection + live notification and message state.
 *
 * WHY the socket lives in a store rather than a component: it must survive
 * route changes. Opening it in a useEffect inside Chat would tear the
 * connection down every time the user navigated away, losing notifications
 * and re-handshaking on the way back.
 */
export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  notifications: [],
  unread: 0,
  // conversationId -> array of messages, so several open threads can be cached
  // without refetching when the user switches between them.
  threads: {},
  typingFrom: null,

  connect: () => {
    // Guard against a double connect: React 18 StrictMode runs effects twice
    // in development, and without this we would open two sockets per tab.
    if (get().socket) return;

    const socket = io({
      // No URL: default to the page's own origin. Same reasoning as the axios
      // baseURL - nothing to configure per environment.
      withCredentials: true, // sends the auth cookie on the handshake
      // The server rejects unauthenticated handshakes, so do not hammer it
      // forever if we are logged out.
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('connect_error', (err) => {
      // 'unauthorized' is expected when the cookie is gone - stop retrying.
      if (err.message === 'unauthorized') socket.close();
      set({ connected: false });
    });

    socket.on('notification:new', (note) => {
      set((state) => ({
        // Cap the in-memory list: the bell only ever shows the newest few, and
        // an unbounded array would grow all session.
        notifications: [note, ...state.notifications].slice(0, 30),
        unread: state.unread + 1,
      }));
    });

    socket.on('message:new', (message) => {
      set((state) => {
        const existing = state.threads[message.conversation] || [];
        // Deduplicate by id. WHY: the sender gets this event for their own
        // message (so their other tabs update), and they may also have added
        // it optimistically - without this check it would appear twice.
        if (existing.some((m) => String(m._id) === String(message._id))) return state;
        return {
          threads: { ...state.threads, [message.conversation]: [...existing, message] },
        };
      });
    });

    socket.on('typing', ({ from, typing }) => {
      set({ typingFrom: typing ? from : null });
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.close();
    // Wipe the cached state too: on logout the next user of this browser must
    // not see the previous user's threads or notifications.
    set({ socket: null, connected: false, threads: {}, notifications: [], unread: 0 });
  },

  /** Send over the socket, with the server's ack telling us it was persisted. */
  sendMessage: (to, text) =>
    new Promise((resolve, reject) => {
      const socket = get().socket;
      if (!socket?.connected) {
        // Honest failure rather than a silent drop - the UI shows this.
        reject(new Error('Not connected. Check your connection and try again.'));
        return;
      }
      socket.emit('message:send', { to, text }, (ack) => {
        if (ack?.success) resolve(ack.data);
        else reject(new Error(ack?.message || 'Could not send that message.'));
      });
    }),

  emitTyping: (to, typing) => {
    get().socket?.emit('typing', { to, typing });
  },

  /** Load one thread's history from REST and cache it under its conversation key. */
  loadThread: async (userId) => {
    const { data } = await api.get(`/messages/${userId}?limit=50`);
    const key = data.data[0]?.conversation;
    if (key) set((state) => ({ threads: { ...state.threads, [key]: data.data } }));
    return data;
  },

  fetchNotifications: async () => {
    const { data } = await api.get('/notifications?limit=20');
    set({ notifications: data.data, unread: data.unread });
    return data;
  },

  markAllRead: async () => {
    await api.patch('/notifications/read');
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unread: 0,
    }));
  },
}));
