import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymdFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatHolidayDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatNotifTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function attendanceHeadline(att, message) {
  if (message && !att) return { label: 'Setup needed', detail: message, tone: 'amber' };
  if (!att?.startedAt) return { label: 'Not clocked in yet', detail: 'Start your workday from Attendance.', tone: 'slate' };
  if (!att.endedAt) return { label: 'Clocked in', detail: 'Session in progress.', tone: 'emerald' };
  return { label: 'Day complete', detail: 'You have clocked out for today.', tone: 'blue' };
}

const toneRing = {
  slate: 'border-slate-400/80 dark:border-slate-600/80',
  emerald: 'border-emerald-500/60 dark:border-emerald-500/40',
  blue: 'border-blue-500/60 dark:border-blue-500/40',
  amber: 'border-amber-500/60 dark:border-amber-500/40',
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayRes, setTodayRes] = useState(null);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [taskPreview, setTaskPreview] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      axios.get('/api/attendance/today').catch(() => ({ data: {} })),
      axios.get('/api/leave/summary').catch(() => ({ data: {} })),
      axios.get('/api/holidays').catch(() => ({ data: { holidays: [] } })),
      axios.get('/api/notifications').catch(() => ({ data: { notifications: [] } })),
      axios.get('/api/notifications/unread-count').catch(() => ({ data: { count: 0 } })),
      axios.get('/api/tasks/today').catch(() => ({ data: {} })),
    ])
      .then(([t, l, h, n, u, tk]) => {
        if (cancelled) return;
        setTodayRes(t.data || {});
        setLeaveSummary(l.data || {});
        setHolidays(h.data?.holidays || []);
        setNotifications((n.data?.notifications || []).slice(0, 3));
        setUnread(u.data?.count ?? 0);
        setTaskPreview(typeof tk.data?.content === 'string' ? tk.data.content.trim() : '');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workDate = todayRes?.workDate || '';
  const att = todayRes?.attendance;
  const headline = attendanceHeadline(att, todayRes?.message);
  const pendingLeave = leaveSummary?.pendingDaysThisYear ?? 0;
  const remainingLeave = leaveSummary?.remainingDays;

  const upcomingHolidays = (() => {
    const ref = workDate || ymdFromIso(new Date().toISOString());
    return [...holidays]
      .filter((hol) => {
        const ymd = ymdFromIso(hol.date);
        return ymd && ymd >= ref;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  })();

  const worked = att?.durationMinutes != null
    ? `${Math.floor(att.durationMinutes / 60)}h ${att.durationMinutes % 60}m`
    : att?.durationHours != null
      ? `${att.durationHours} hrs`
      : null;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="erp-card animate-pulse">
            <div className="h-4 w-1/3 rounded bg-slate-200/90 dark:bg-slate-700/80" />
            <div className="mt-3 h-3 w-full rounded bg-slate-200/70 dark:bg-slate-700/60" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Hello, {user?.name?.split(' ')[0] || 'there'}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {user?.companyName ? (
            <>
              <span className="text-slate-800 dark:text-slate-300">{user.companyName}</span>
              {' · '}
            </>
          ) : null}
          Here&apos;s your day at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={`erp-card border-l-4 ${toneRing[headline.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today&apos;s attendance</p>
              <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{headline.label}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{headline.detail}</p>
              {workDate && <p className="mt-2 text-xs text-slate-500">Work date: {workDate}</p>}
              {worked && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Time logged: {worked}</p>}
            </div>
            <Link
              to="/attendance"
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Open
            </Link>
          </div>
        </div>

        <div className="erp-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leave</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                {pendingLeave > 0 ? (
                  <>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">{pendingLeave}</span> day
                    {pendingLeave !== 1 ? 's' : ''} pending approval
                  </>
                ) : (
                  'No pending leave requests'
                )}
              </p>
              {remainingLeave != null && (
                <p className="mt-2 text-xs text-slate-500">Estimated remaining leave days this year: {remainingLeave}</p>
              )}
            </div>
            <Link
              to="/leave"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Leave
            </Link>
          </div>
        </div>

        <div className="erp-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today&apos;s tasks</p>
              {taskPreview ? (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {taskPreview}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No plan saved yet for today.</p>
              )}
            </div>
            <Link
              to="/tasks"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Edit
            </Link>
          </div>
        </div>

        <div className="erp-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming holidays</p>
          {upcomingHolidays.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No upcoming holidays listed.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcomingHolidays.map((h) => (
                <li key={h._id || h.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-slate-800 dark:text-slate-200">{h.name}</span>
                  <span className="shrink-0 text-slate-500 dark:text-slate-400">{formatHolidayDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/holidays" className="erp-link mt-4 inline-block text-xs font-semibold">
            View calendar →
          </Link>
        </div>

        <div className="erp-card md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                {unread > 99 ? '99+' : unread} unread
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">You&apos;re all caught up.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700/80">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-400 dark:bg-slate-600' : 'bg-blue-500'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-slate-500">{formatNotifTime(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="erp-link mt-4 inline-block text-xs font-semibold">
            Open inbox →
          </Link>
        </div>
      </div>
    </div>
  );
}
