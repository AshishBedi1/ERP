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

function rowStatus(row) {
  const att = row.attendance;
  if (!att?.startedAt) return 'notIn';
  if (!att.endedAt) return 'inSession';
  return 'done';
}

export default function EmployerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workDate, setWorkDate] = useState('');
  const [team, setTeam] = useState([]);
  const [headcount, setHeadcount] = useState(0);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      axios.get('/api/attendance/team-today').catch(() => ({ data: { team: [] } })),
      axios.get('/api/employer/employees').catch(() => ({ data: { employees: [] } })),
      axios.get('/api/holidays').catch(() => ({ data: { holidays: [] } })),
    ])
      .then(([today, emps, hol]) => {
        if (cancelled) return;
        setWorkDate(today.data?.workDate || '');
        setTeam(today.data?.team || []);
        setHeadcount((emps.data?.employees || []).length);
        setHolidays(hol.data?.holidays || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notIn = team.filter((r) => rowStatus(r) === 'notIn').length;
  const inSession = team.filter((r) => rowStatus(r) === 'inSession').length;
  const done = team.filter((r) => rowStatus(r) === 'done').length;
  const tasksSubmitted = team.filter((r) => (r.todayTasks || '').trim().length > 0).length;

  const upcomingHolidays = (() => {
    const ref = workDate || ymdFromIso(new Date().toISOString());
    return [...holidays]
      .filter((hol) => {
        const ymd = ymdFromIso(hol.date);
        return ymd && ymd >= ref;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  })();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="erp-card animate-pulse">
            <div className="h-4 w-1/3 rounded bg-slate-200/90 dark:bg-slate-700/80" />
            <div className="mt-3 h-8 w-1/2 rounded bg-slate-200/70 dark:bg-slate-700/60" />
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
          <span className="font-medium text-slate-800 dark:text-slate-300">{user?.companyName?.trim() || 'Your company'}</span>
          {workDate ? ` · Work date ${workDate}` : ''}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="erp-card md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team today</p>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
                Team size = people on your roster. Clocked in = working now. Finished for today = logged out. Not clocked
                in yet = no login today.
              </p>
            </div>
            <Link
              to="/employer/attendance"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Attendance
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/90 bg-slate-100/90 px-4 py-3 text-center dark:border-slate-700/60 dark:bg-slate-900/40">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{headcount}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Team size</p>
            </div>
            <div className="rounded-xl border border-emerald-300/80 bg-emerald-50 px-4 py-3 text-center dark:border-emerald-500/30 dark:bg-emerald-950/20">
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{inSession}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400/80">
                Clocked in
              </p>
            </div>
            <div className="rounded-xl border border-blue-300/80 bg-blue-50 px-4 py-3 text-center dark:border-blue-500/30 dark:bg-blue-950/20">
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{done}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400/80">
                Finished for today
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-slate-100/90 px-4 py-3 text-center dark:border-slate-600/80 dark:bg-slate-900/40">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{notIn}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Not clocked in yet</p>
            </div>
          </div>
        </div>

        <div className="erp-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming holidays</p>
            <Link to="/holidays" className="erp-link shrink-0 text-xs font-semibold">
              View &amp; edit →
            </Link>
          </div>
          {upcomingHolidays.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No upcoming holidays listed. Add dates on the Holidays page.
            </p>
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
        </div>

        <div className="erp-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today&apos;s task plans</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{tasksSubmitted}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{team.length}</span> employees shared a
                plan today.
              </p>
            </div>
            <Link
              to="/employer/tasks"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View
            </Link>
          </div>
        </div>

        <div className="erp-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/employer/attendance" className="erp-link">
                Attendance →
              </Link>
            </li>
            <li>
              <Link to="/employer/team" className="erp-link">
                Your team →
              </Link>
            </li>
            <li>
              <Link to="/employer/add-employee" className="erp-link">
                Add employee →
              </Link>
            </li>
            <li>
              <Link to="/holidays" className="erp-link">
                Company holidays →
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
