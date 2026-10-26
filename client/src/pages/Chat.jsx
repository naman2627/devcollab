import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import Spinner from '../components/Spinner.jsx';
import { useAuthStore } from '../store/authStore.js';
import { useSocketStore } from '../store/socketStore.js';

/** Same algorithm as the server's conversationKey - sorted pair join. */
const keyFor = (a, b) => [String(a), String(b)].sort().join('_');

export default function Chat() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const threads = useSocketStore((s) => s.threads);
  const connected = useSocketStore((s) => s.connected);
  const typingFrom = useSocketStore((s) => s.typingFrom);
  const sendMessage = useSocketStore((s) => s.sendMessage);
  const emitTyping = useSocketStore((s) => s.emitTyping);
  const loadThread = useSocketStore((s) => s.loadThread);

  const [conversations, setConversations] = useState([]);
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  const conversationId = userId && me ? keyFor(me._id, userId) : null;
  const messages = conversationId ? threads[conversationId] || [] : [];

  // Sidebar list.
  useEffect(() => {
    api
      .get('/messages/conversations')
      .then(({ data }) => setConversations(data.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Load the open thread's history whenever the route param changes.
  useEffect(() => {
    if (!userId) return;
    setError('');
    loadThread(userId)
      .then((data) => setPeer(data.user))
      .catch((err) => setError(err.message));
  }, [userId, loadThread]);

  // Scroll to the newest message. WHY on messages.length and not on every
  // render: re-scrolling on an unrelated state change (typing indicator) would
  // yank the view while the user is reading history.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onType = (value) => {
    setText(value);
    if (!userId) return;

    emitTyping(userId, true);
    // Debounced "stopped typing": clear the previous timer so the signal is
    // only sent once, 1.2s after the last keystroke, rather than per key.
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(userId, false), 1200);
  };

  // Clear the pending timer on unmount, or it fires into a dead component.
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const onSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !userId) return;

    setSending(true);
    setError('');
    try {
      // No optimistic append: the server echoes the saved message back over
      // the socket to the sender's own tabs, and the store dedupes by _id. So
      // the message appears once, and only once it is actually durable.
      await sendMessage(userId, body);
      setText('');
      emitTyping(userId, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Chat</h1>
        <span
          className={`chip ${connected ? 'text-emerald-300' : 'text-amber-300'}`}
          title={connected ? 'Realtime connected' : 'Reconnecting'}
        >
          {connected ? 'live' : 'offline'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <aside className="card overflow-hidden">
          <h2 className="border-b border-edge px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Conversations
          </h2>

          {loading ? (
            <div className="p-6 text-center">
              <Spinner />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              No conversations yet. Accept an application, or message a project owner from their
              project page.
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-edge overflow-y-auto">
              {conversations.map((convo) => (
                <li key={convo.conversation}>
                  <button
                    onClick={() => navigate(`/chat/${convo.user?._id}`)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 ${
                      String(convo.user?._id) === String(userId) ? 'bg-surface-2' : ''
                    }`}
                  >
                    <Avatar user={convo.user} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        @{convo.user?.username}
                      </p>
                      <p className="truncate text-xs text-slate-500">{convo.lastMessage?.text}</p>
                    </div>
                    {convo.unread > 0 && (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                        {convo.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="card flex min-h-[28rem] flex-col">
          {!userId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
              Pick a conversation to start reading.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-edge px-4 py-3">
                <Avatar user={peer} size="md" />
                <div className="min-w-0">
                  <Link
                    to={`/u/${peer?.username}`}
                    className="text-sm font-medium text-white hover:underline"
                  >
                    {peer?.name || 'Loading...'}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {String(typingFrom) === String(userId) ? (
                      <span className="text-brand-soft">typing...</span>
                    ) : (
                      `@${peer?.username || ''}`
                    )}
                  </p>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No messages yet. Say hello.
                  </p>
                )}

                {messages.map((message) => {
                  const mine = String(message.sender) === String(me._id);
                  return (
                    <div
                      key={message._id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? 'bg-brand text-white'
                            : 'border border-edge bg-surface-2 text-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        <p
                          className={`mt-1 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-500'}`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Scroll anchor - an empty div is cheaper than measuring the
                    container's scrollHeight on every update. */}
                <div ref={bottomRef} />
              </div>

              {error && (
                <p role="alert" className="border-t border-red-900/40 bg-red-950/30 px-4 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              <form onSubmit={onSend} className="flex gap-2 border-t border-edge p-3">
                <input
                  className="input"
                  placeholder={connected ? 'Write a message...' : 'Reconnecting...'}
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  maxLength={2000}
                  disabled={!connected}
                  aria-label="Message text"
                />
                <button className="btn-primary" disabled={sending || !text.trim() || !connected}>
                  {sending && <Spinner />} Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
