import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

/**
 * Notifications list (shared by /notifications redirect and Inbox right column).
 */
export default function NotificationsPanel({ inboxColumn = false }) {
  const { isEmployer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    axios
      .get('/api/notifications')
      .then(({ data }) => setItems(data.notifications || []))
      .catch(() => {
        setError('Could not load notifications.');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      await axios.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch {
      /* ignore */
    }
  };

  const deleteNotification = async (id) => {
    setDeletingId(id);
    setError('');
    try {
      await axios.delete(`/api/notifications/${id}`);
      setItems((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete notification.');
    } finally {
      setDeletingId(null);
    }
  };

  const decideLeave = async (leaveRequestId, action) => {
    const id = leaveRequestId?._id ?? leaveRequestId;
    if (!id) return;
    setBusyId(String(id));
    setError('');
    try {
      await axios.patch(`/api/employer/leave-requests/${id}`, { action });
      await load();
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update leave request.');
    } finally {
      setBusyId(null);
    }
  };

  const unread = items.filter((n) => !n.read).length;

  const showLeaveActions = (n) =>
    isEmployer && n.type === 'leave_request' && n.leaveStatus === 'pending' && n.leaveRequestId;

  const shell = inboxColumn
    ? 'border-slate-300/80 bg-white dark:border-slate-600/80 dark:bg-slate-800/50'
    : 'border-slate-300/80 bg-slate-200/35 dark:border-slate-700/60 dark:bg-slate-800/40';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col text-slate-800 dark:text-slate-100">
      <div
        className={`shrink-0 border-b px-4 py-3 sm:px-4 ${
          inboxColumn
            ? 'border-slate-300/80 bg-slate-200/70 dark:border-slate-700 dark:bg-slate-800/90'
            : 'border-slate-300/80 dark:border-slate-700/80'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">Notifications</h2>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                inboxColumn
                  ? 'border border-slate-400/70 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'
                  : 'border border-slate-400/70 bg-slate-300/70 text-slate-800 hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              Mark all read
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {unread > 0 ? (
            <span>
              <span className="font-medium text-amber-800 dark:text-amber-200">{unread}</span> unread
            </span>
          ) : (
            "You're all caught up."
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3 rounded-xl border border-slate-300/60 bg-slate-200/50 p-6 dark:border-slate-700/60 dark:bg-slate-800/40">
            <div className="h-4 w-3/4 rounded bg-slate-300/80 dark:bg-slate-700/80" />
            <div className="h-4 w-1/2 rounded bg-slate-300/60 dark:bg-slate-700/60" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul className={`divide-y divide-slate-200/90 rounded-xl border dark:divide-slate-700 ${shell}`}>
            {items.map((n) => (
              <li key={n.id}>
                <div
                  className={`flex gap-2 px-3 py-3 sm:px-4 ${
                    !n.read ? (inboxColumn ? 'bg-blue-50/80 dark:bg-slate-900/50' : 'bg-slate-300/45 dark:bg-slate-900/40') : ''
                  }`}
                >
                  <div
                    className={`min-w-0 flex-1 flex flex-col gap-1 ${
                      !showLeaveActions(n)
                        ? `cursor-pointer ${inboxColumn ? 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60' : 'hover:bg-slate-200/80 dark:hover:bg-slate-800/60'}`
                        : ''
                    } -mx-1 rounded-lg px-1 py-0`}
                    onClick={() => {
                      if (!showLeaveActions(n) && !n.read) markRead(n.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !showLeaveActions(n) && !n.read) markRead(n.id);
                    }}
                    role={showLeaveActions(n) ? undefined : 'button'}
                    tabIndex={showLeaveActions(n) ? undefined : !n.read ? 0 : undefined}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          !n.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="shrink-0 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-900">
                          New
                        </span>
                      )}
                    </div>
                    {n.body && <p className="text-sm text-slate-600 dark:text-slate-400">{n.body}</p>}
                    <p className="text-xs text-slate-500">{formatWhen(n.createdAt)}</p>

                    {showLeaveActions(n) && (
                      <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={busyId === String(n.leaveRequestId || '')}
                          onClick={() => decideLeave(n.leaveRequestId, 'approve')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === String(n.leaveRequestId || '')}
                          onClick={() => decideLeave(n.leaveRequestId, 'reject')}
                          className="rounded-lg border border-red-500/60 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-950/80 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === n.id}
                    onClick={() => deleteNotification(n.id)}
                    className="mt-0.5 shrink-0 self-start rounded-lg border border-slate-400/50 p-2 text-slate-500 transition hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-300 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400"
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    {deletingId === n.id ? (
                      <span className="block h-4 w-4 animate-pulse rounded bg-slate-400/50" />
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
