import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/** DM message poll: faster while the tab is visible, slower in the background */
const CHAT_POLL_VISIBLE_MS = 3500;
const CHAT_POLL_HIDDEN_MS = 25000;

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function shortInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function ComposerToolbar({ disabled }) {
  const btn =
    'rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-200';
  const items = [
    { label: 'Bold', content: <span className="font-bold">B</span> },
    { label: 'Italic', content: <span className="italic">I</span> },
    { label: 'Strikethrough', content: <span className="line-through">S</span> },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/90 px-2 py-1.5 dark:border-slate-600/80">
      {items.map(({ label, content }) => (
        <button key={label} type="button" disabled={disabled} title={`${label} (plain text only)`} className={btn} aria-hidden tabIndex={-1}>
          {content}
        </button>
      ))}
      <button type="button" disabled={disabled} className={btn} title="Link (plain text only)" aria-hidden tabIndex={-1}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      </button>
      <button type="button" disabled={disabled} className={btn} title="List" aria-hidden tabIndex={-1}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </button>
      <button type="button" disabled={disabled} className={btn} title="Numbered list" aria-hidden tabIndex={-1}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h12M7 12h12M7 16h12M4 8h.01M4 12h.01M4 16h.01" />
        </svg>
      </button>
    </div>
  );
}

function ComposerFooterActions({ disabled }) {
  const btn =
    'rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/90 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700/80';
  return (
    <div className="flex items-center gap-0.5 border-t border-slate-200/90 px-2 py-1.5 dark:border-slate-600/80">
      <button type="button" disabled={disabled} className={btn} title="Attach (not available)" aria-hidden tabIndex={-1}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <button type="button" disabled={disabled} className={btn} title="Formatting" aria-hidden tabIndex={-1}>
        <span className="text-xs font-semibold">Aa</span>
      </button>
      <button type="button" disabled={disabled} className={btn} title="Emoji" aria-hidden tabIndex={-1}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.182 15.182a4.5 4.5 0 01-6.364 0M12 3v.01M12 21v.01M4.22 4.22l.01.01M19.77 19.77l.01.01M3 12h.01M21 12h.01M4.22 19.78l.01-.01M19.77 4.22l.01-.01"
          />
        </svg>
      </button>
      <button type="button" disabled={disabled} className={btn} title="Mention" aria-hidden tabIndex={-1}>
        <span className="text-sm font-semibold">@</span>
      </button>
    </div>
  );
}

export default function ChatThread({
  withUserId,
  peerName,
  peerHint,
  backTo,
  backLabel = 'Back',
  emptyHint = 'No messages yet. Say hello!',
  variant = 'default',
  fillHeight = false,
}) {
  const inbox = variant === 'inbox';
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [peer, setPeer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadOlderBusy, setLoadOlderBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sendError, setSendError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markRead = useCallback(() => {
    if (!withUserId) return;
    axios.post('/api/chat/read', { withUserId }).then(() => {
      window.dispatchEvent(new Event('chat-updated'));
    }).catch(() => {});
  }, [withUserId]);

  const loadInitial = useCallback(() => {
    if (!withUserId) return;
    setLoading(true);
    axios
      .get('/api/chat/messages', { params: { withUserId, limit: 50 } })
      .then(({ data }) => {
        setMessages(data.messages || []);
        setPeer(data.peer || null);
        setHasMore(!!data.hasMore);
        markRead();
      })
      .catch(() => {
        setMessages([]);
        setPeer(null);
      })
      .finally(() => setLoading(false));
  }, [withUserId, markRead]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!loading && messages.length) {
      scrollToBottom();
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (!withUserId) return;

    const poll = () => {
      axios
        .get('/api/chat/messages', { params: { withUserId, limit: 50 } })
        .then(({ data }) => {
          setMessages(data.messages || []);
          setPeer(data.peer || null);
          setHasMore(!!data.hasMore);
          markRead();
        })
        .catch(() => {});
    };

    const intervalMs = () =>
      document.visibilityState === 'visible' ? CHAT_POLL_VISIBLE_MS : CHAT_POLL_HIDDEN_MS;

    let t = setInterval(poll, intervalMs());

    const onVisibility = () => {
      clearInterval(t);
      if (document.visibilityState === 'visible') {
        poll();
      }
      t = setInterval(poll, intervalMs());
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [withUserId, markRead]);

  const loadOlder = async () => {
    if (!withUserId || !messages.length || loadOlderBusy || !hasMore) return;
    const oldest = messages[0];
    setLoadOlderBusy(true);
    const prevScroll = listRef.current?.scrollHeight ?? 0;
    try {
      const { data } = await axios.get('/api/chat/messages', {
        params: { withUserId, limit: 50, before: oldest.id },
      });
      const older = data.messages || [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(!!data.hasMore);
      requestAnimationFrame(() => {
        if (listRef.current) {
          const next = listRef.current.scrollHeight;
          listRef.current.scrollTop = next - prevScroll;
        }
      });
    } catch {
      /* ignore */
    } finally {
      setLoadOlderBusy(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !withUserId || sending) return;
    setSendError('');
    setSending(true);
    try {
      const { data } = await axios.post('/api/chat/messages', {
        withUserId,
        body: trimmed,
      });
      setText('');
      setMessages((prev) => [...prev, data.message]);
      window.dispatchEvent(new Event('chat-updated'));
      scrollToBottom();
    } catch (err) {
      setSendError(err.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const displayName = peer?.name || peerName || 'Chat';
  const displayHint = peerHint || peer?.email;

  const rootClass = inbox
    ? `flex min-h-0 flex-1 flex-col overflow-hidden ${fillHeight ? 'h-full min-h-[12rem]' : ''}`
    : `flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200/90 bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-900/40`;

  const messageListBg = inbox ? 'bg-slate-100/90 dark:bg-slate-900/60' : '';

  return (
    <div className={rootClass}>
      <div
        className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 ${
          inbox
            ? 'border-slate-300/80 bg-slate-200/70 dark:border-slate-700 dark:bg-slate-800/90'
            : 'border-slate-200/90 dark:border-slate-700/80'
        }`}
      >
        <div className="min-w-0">
          {backTo && (
            <Link
              to={backTo}
              className={`mb-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              {backLabel}
            </Link>
          )}
          <h2 className={`truncate text-lg font-semibold ${inbox ? 'text-slate-900 dark:text-slate-50' : 'text-slate-900 dark:text-slate-100'}`}>
            {displayName}
          </h2>
          {displayHint && (
            <p className={`truncate text-sm ${inbox ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{displayHint}</p>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 ${messageListBg}`}
        style={fillHeight ? undefined : { maxHeight: 'min(60vh, 520px)' }}
      >
        {loading ? (
          <p className="text-center text-sm text-slate-500">Loading messages…</p>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadOlderBusy}
                  className="rounded-lg border border-slate-300/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {loadOlderBusy ? 'Loading…' : 'Load older messages'}
                </button>
              </div>
            )}
            {messages.length === 0 && <p className="text-center text-sm text-slate-500">{emptyHint}</p>}
            {messages.map((m) => {
              const mine = String(m.senderId) === String(user?.id || user?._id);
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && inbox && (
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-900 dark:bg-slate-700 dark:text-slate-100">
                      {shortInitials(peer?.name || peerName)}
                    </div>
                  )}
                  <div
                    className={`max-w-[min(85%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      mine
                        ? 'bg-blue-600 text-white shadow-blue-900/10'
                        : inbox
                          ? 'border border-slate-300/80 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                          : 'border border-slate-200/90 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={`mt-1 text-[10px] tabular-nums ${
                        mine ? 'text-blue-100/90' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {inbox ? (
        <form onSubmit={send} className="shrink-0 border-t border-slate-300/80 bg-slate-200/50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
          {sendError && (
            <div className="mb-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">{sendError}</div>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-300/90 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
            <ComposerToolbar disabled />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${displayName}`}
              rows={3}
              className="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              maxLength={8000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/90 dark:border-slate-600/80">
              <ComposerFooterActions disabled />
              <div className="pr-2 pb-1">
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {sending ? (
                    '…'
                  ) : (
                    <>
                      <span>Send</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <form
          onSubmit={send}
          className="shrink-0 border-t border-slate-200/90 p-3 dark:border-slate-700/80 sm:p-4"
        >
          {sendError && (
            <div className="mb-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">{sendError}</div>
          )}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              rows={2}
              className="erp-input-inline min-h-11 flex-1 resize-y"
              maxLength={8000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="self-end rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
