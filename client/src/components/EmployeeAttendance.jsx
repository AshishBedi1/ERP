import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AttendanceCalendarModal from './AttendanceCalendarModal';

const shellClass =
  'relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-stone-50 via-slate-50 to-slate-100 shadow-xl shadow-slate-300/40 ring-1 ring-slate-200/70 dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-950 dark:shadow-black/50 dark:ring-white/[0.06]';

function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatWorkDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatWorkedSummary(att) {
  if (att?.durationMinutes != null) {
    const h = Math.floor(att.durationMinutes / 60);
    const m = att.durationMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  if (att?.durationHours != null) {
    return `${att.durationHours} hrs`;
  }
  return '—';
}

function timezoneLabel(iana) {
  const map = {
    'Asia/Kolkata': 'India Standard Time (IST)',
    'Asia/Dubai': 'Gulf Standard Time (GST)',
    'Asia/Singapore': 'Singapore Time (SGT)',
    UTC: 'Coordinated Universal Time (UTC)',
  };
  return map[iana] || iana.replace(/_/g, ' ');
}

function StatusBadge({ children, tone }) {
  const tones = {
    idle: 'border-slate-300/90 bg-slate-200/90 text-slate-800 dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-slate-300',
    live: 'border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-200',
    done: 'border-slate-300/70 bg-slate-100/90 text-slate-800 dark:border-slate-500/50 dark:bg-slate-800/60 dark:text-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function EmployeeAttendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submittingIn, setSubmittingIn] = useState(false);
  const [submittingOut, setSubmittingOut] = useState(false);
  const [workDate, setWorkDate] = useState('');
  const [workTimezone, setWorkTimezone] = useState('Asia/Kolkata');
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [testResetEnabled, setTestResetEnabled] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const noEmployer = !user?.employerId;

  const load = useCallback((opts = {}) => {
    const silent = opts.silent;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    return axios
      .get('/api/attendance/today')
      .then(({ data }) => {
        setWorkDate(data.workDate || '');
        if (data.workTimezone) setWorkTimezone(data.workTimezone);
        setTestResetEnabled(!!data.testResetEnabled);
        setAttendance(data.attendance || null);
      })
      .catch(() => {
        if (!silent) {
          setError('Could not load attendance.');
          setAttendance(null);
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (noEmployer) {
      setLoading(false);
      return;
    }
    load();
  }, [load, noEmployer]);

  useEffect(() => {
    if (noEmployer) return;
    const id = setInterval(() => load({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [load, noEmployer]);

  useEffect(() => {
    if (noEmployer) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load, noEmployer]);

  const started = !!attendance?.startedAt;
  const ended = !!attendance?.endedAt;

  useEffect(() => {
    if (!started || ended) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [started, ended]);

  const elapsedLive = useMemo(() => {
    if (!attendance?.startedAt || ended) return null;
    const start = new Date(attendance.startedAt).getTime();
    return formatElapsed(Date.now() - start);
  }, [attendance?.startedAt, ended, tick]);

  const markLogin = async () => {
    setError('');
    setSubmittingIn(true);
    try {
      const { data } = await axios.post('/api/attendance/check-in');
      setWorkDate(data.workDate || workDate);
      if (data.workTimezone) setWorkTimezone(data.workTimezone);
      setAttendance(data.attendance);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.message || 'Could not mark attendance.';
      if (d?.workTimezone) setWorkTimezone(d.workTimezone);
      if (d?.attendance) setAttendance(d.attendance);
      setError(msg);
    } finally {
      setSubmittingIn(false);
    }
  };

  const markLogout = async () => {
    setError('');
    setSubmittingOut(true);
    try {
      const { data } = await axios.post('/api/attendance/check-out');
      setWorkDate(data.workDate || workDate);
      setAttendance(data.attendance);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not log out.';
      setError(msg);
    } finally {
      setSubmittingOut(false);
    }
  };

  const resetTodayForTesting = async () => {
    if (!window.confirm('Clear today’s attendance? You can use Login again for testing.')) return;
    setError('');
    setResetting(true);
    try {
      await axios.post('/api/attendance/reset-today');
      await load({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset attendance.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-none">
        <div className={`${shellClass} flex min-h-[calc(100dvh-10rem)] flex-col px-6 py-14 sm:px-10 lg:px-12`}>
          <div className="w-full animate-pulse space-y-4">
            <div className="h-3 w-24 rounded-full bg-slate-700/80" />
            <div className="h-10 w-full max-w-2xl rounded-xl bg-slate-700/60" />
            <div className="h-32 w-full rounded-2xl bg-slate-700/40" />
          </div>
        </div>
      </div>
    );
  }

  if (noEmployer) {
    return (
      <div className="w-full max-w-none">
        <div className={`${shellClass} flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center px-6 py-10 sm:px-10 lg:px-12`}>
          <p className="text-center text-sm leading-relaxed text-slate-400">
            Attendance will be available once your account is linked to your employer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none">
      <div className={`${shellClass} flex min-h-[calc(100dvh-10rem)] flex-col`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-500/35 to-transparent" />

        <div className="relative border-b border-slate-700/50 bg-slate-900/30 px-6 py-5 sm:px-10 lg:px-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Work date</p>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                title="View attendance calendar"
                className="group mt-2 w-full max-w-xl rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-slate-600/60 hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:px-3"
              >
                <p className="text-lg font-semibold tracking-tight text-slate-50 group-hover:text-white sm:text-xl">
                  {formatWorkDate(workDate)}
                </p>
                <p className="mt-1 text-xs text-slate-500 group-hover:text-slate-400">
                  Clock times follow your device; the work day follows company time.{' '}
                  <span className="text-emerald-400/90 underline decoration-emerald-500/40 underline-offset-2">Open calendar</span>
                </p>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!started && <StatusBadge tone="idle">Not started</StatusBadge>}
              {started && !ended && <StatusBadge tone="live">In progress</StatusBadge>}
              {testResetEnabled && (
                <button
                  type="button"
                  disabled={resetting}
                  title="Clear today’s attendance (testing only)"
                  onClick={resetTodayForTesting}
                  className="rounded-lg border border-amber-600/45 bg-amber-950/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-900/50 disabled:opacity-50"
                >
                  {resetting ? '…' : 'Reset today'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col px-6 py-7 sm:px-10 lg:px-12">
          {!started && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-950/25 to-slate-950/40 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-emerald-100/70">Not logged in</p>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-500" />
                  </span>
                </div>
                <p className="mt-2 text-xs text-emerald-200/45">
                  Timer starts after you log in
                </p>
                <p className="mt-6 font-mono text-4xl font-semibold tabular-nums tracking-tight text-white/90 sm:text-5xl">0:00</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">Elapsed</p>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-amber-900/30 bg-amber-950/20 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="text-sm leading-relaxed text-amber-100/80">
                  Starting work? Login records your start time and begins the session timer.
                </p>
                <button
                  type="button"
                  disabled={submittingIn}
                  onClick={markLogin}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
                >
                  {submittingIn ? (
                    'Saving…'
                  ) : (
                    <>
                      <svg className="h-5 w-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Login
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {started && !ended && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-950/40 to-slate-950/40 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-emerald-100/90">Session active</p>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                </div>
                <p className="mt-2 text-xs text-emerald-200/60">
                  Started at <span className="font-semibold text-emerald-100">{formatClock(attendance.startedAt)}</span>
                </p>
                <p className="mt-6 font-mono text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl">{elapsedLive}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">Elapsed</p>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-amber-900/30 bg-amber-950/20 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="text-sm leading-relaxed text-amber-100/80">
                  Finishing for the day? Logout records your end time and total hours.
                </p>
                <button
                  type="button"
                  disabled={submittingOut}
                  onClick={markLogout}
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-950/50 px-6 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-950/80 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
                >
                  {submittingOut ? 'Saving…' : 'Logout'}
                </button>
              </div>
            </div>
          )}

          {started && ended && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-stretch lg:gap-8">
              <main className="min-w-0 rounded-2xl border border-slate-600/50 bg-slate-950/50 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Summary</p>
                <p className="mt-1 text-base font-medium text-slate-200">Times and duration</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Start</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-slate-50">{formatClock(attendance.startedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">End</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-slate-50">{formatClock(attendance.endedAt)}</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-700/60 pt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total worked</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-300 sm:text-4xl">
                    {formatWorkedSummary(attendance)}
                  </p>
                </div>
              </main>

              <aside
                aria-label="Completion status"
                className="flex min-h-full flex-col justify-between rounded-2xl border border-emerald-500/25 bg-linear-to-b from-emerald-950/40 via-emerald-950/20 to-slate-950/50 p-5 sm:p-6"
              >
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/35"
                    aria-hidden
                  >
                    <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-emerald-50">Day complete</h3>
                  <p className="mt-1.5 text-sm text-slate-400">Session closed and saved.</p>
                  <div className="mt-4">
                    <StatusBadge tone="done">Completed</StatusBadge>
                  </div>
                </div>

                <div className="mt-8 border-t border-emerald-900/40 pt-5">
                  <p className="text-xs leading-relaxed text-slate-400">
                    Today’s attendance is saved. After midnight ({timezoneLabel(workTimezone)}), you can start a new session.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>

      <AttendanceCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        workDate={workDate}
        workTimezoneLabel={timezoneLabel(workTimezone)}
      />
    </div>
  );
}
