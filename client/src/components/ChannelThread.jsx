import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/** Channel message poll: faster while the tab is visible, slower in the background */
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
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/90 px-2 py-1.5 dark:border-slate-600/80">
      {['Bold', 'Italic', 'Strike'].map((label) => (
        <button key={label} type="button" disabled={disabled} className={btn} aria-hidden tabIndex={-1}>
          {label[0]}
        </button>
      ))}
    </div>
  );
}

function ComposerFooterActions({ disabled }) {
  const btn =
    'rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/90 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700/80';
  return (
    <div className="flex items-center gap-0.5 border-t border-slate-200/90 px-2 py-1.5 dark:border-slate-600/80">
      <button type="button" disabled={disabled} className={btn} aria-hidden tabIndex={-1}>
        +
      </button>
      <button type="button" disabled={disabled} className={btn} aria-hidden tabIndex={-1}>
        @
      </button>
    </div>
  );
}

export default function ChannelThread({ channelId, fillHeight = false }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [memberById, setMemberById] = useState({});
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

  const loadInitial = useCallback(() => {
    if (!channelId) return;
    setLoading(true);
    axios
      .get(`/api/chat/channels/${channelId}/messages`, { params: { limit: 50 } })
      .then(({ data }) => {
        setMessages(data.messages || []);
        const ch = data.channel;
        setChannel(ch);
        const map = {};
        (ch?.members || []).forEach((m) => {
          map[String(m.id)] = m.name || m.email || 'Member';
        });
        setMemberById(map);
        setHasMore(!!data.hasMore);
      })
      .catch(() => {
        setMessages([]);
        setChannel(null);
        setMemberById({});
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!loading && messages.length) {
      scrollToBottom();
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (!channelId) return;

    const poll = () => {
      axios
        .get(`/api/chat/channels/${channelId}/messages`, { params: { limit: 50 } })
        .then(({ data }) => {
          setMessages(data.messages || []);
          const ch = data.channel;
          setChannel(ch);
          const map = {};
          (ch?.members || []).forEach((m) => {
            map[String(m.id)] = m.name || m.email || 'Member';
          });
          setMemberById(map);
          setHasMore(!!data.hasMore);
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
  }, [channelId]);

  const loadOlder = async () => {
    if (!channelId || !messages.length || loadOlderBusy || !hasMore) return;
    const oldest = messages[0];
    setLoadOlderBusy(true);
    const prevScroll = listRef.current?.scrollHeight ?? 0;
    try {
      const { data } = await axios.get(`/api/chat/channels/${channelId}/messages`, {
        params: { limit: 50, before: oldest.id },
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
    if (!trimmed || !channelId || sending) return;
    setSendError('');
    setSending(true);
    try {
      const { data } = await axios.post(`/api/chat/channels/${channelId}/messages`, {
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

  const displayName = channel?.name || 'Channel';
  const rootClass = `flex min-h-0 flex-1 flex-col overflow-hidden ${fillHeight ? 'h-full min-h-[12rem]' : ''}`;
  const messageListBg = 'bg-slate-100/90 dark:bg-slate-900/60';

  return (
    <div className={rootClass}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300/80 bg-slate-200/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{displayName}</h2>
          {channel?.members?.length ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {channel.members.length} people ·{' '}
              {channel.members
                .map((m) => m.name || m.email)
                .slice(0, 4)
                .join(', ')}
              {channel.members.length > 4 ? '…' : ''}
            </p>
          ) : null}
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
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-500">No messages yet. Say something to the group.</p>
            )}
            {messages.map((m) => {
              const mine = String(m.senderId) === String(user?.id || user?._id);
              const senderName = memberById[String(m.senderId)] || 'Member';
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && (
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-900 dark:bg-slate-700 dark:text-slate-100">
                      {shortInitials(senderName)}
                    </div>
                  )}
                  <div
                    className={`max-w-[min(85%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      mine
                        ? 'bg-blue-600 text-white shadow-blue-900/10'
                        : 'border border-slate-300/80 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {!mine && (
                      <p className="mb-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{senderName}</p>
                    )}
                    <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
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
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
