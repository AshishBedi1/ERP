import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Notifications() {
  const { isEmployer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

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

  return (
    <AppShell title="Notifications">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {unread > 0 ? (
              <span>
                <span className="font-medium text-amber-800 dark:text-amber-200">{unread}</span> unread
              </span>
            ) : (
              'You’re all caught up.'
            )}
          </p>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-8 dark:border-slate-700/60 dark:bg-slate-800/40">
            <div className="h-4 w-3/4 rounded bg-slate-200/90 dark:bg-slate-700/80" />
            <div className="h-4 w-1/2 rounded bg-slate-200/70 dark:bg-slate-700/60" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200/90 bg-slate-50/95 dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-800/40">
            {items.map((n) => (
              <li key={n.id}>
                <div
                  className={`flex flex-col gap-1 px-4 py-4 ${
                    !n.read ? 'bg-slate-100/90 dark:bg-slate-900/40' : ''
                  } ${!showLeaveActions(n) ? 'cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-800/60' : ''}`}
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
                      className={`text-sm font-semibold ${!n.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-500/25 dark:text-amber-200">
                        New
                      </span>
                    )}
                  </div>
                  {n.body && <p className="text-sm text-slate-600 dark:text-slate-400">{n.body}</p>}
                  <p className="text-xs text-slate-500">{formatWhen(n.createdAt)}</p>

                  {showLeaveActions(n) && (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
