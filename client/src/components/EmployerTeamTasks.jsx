import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AttendanceCalendarModal from './AttendanceCalendarModal';

function planTextFromRow(row) {
  if (typeof row.todayTasks === 'string') return row.todayTasks;
  if (Array.isArray(row.todayTasks)) {
    return row.todayTasks.map((p) => String(p?.text || '')).join('\n');
  }
  return '';
}

export default function EmployerTeamTasks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [workTimezone, setWorkTimezone] = useState('');
  const [team, setTeam] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSubject, setCalendarSubject] = useState(null);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    axios
      .get('/api/attendance/team-today')
      .then(({ data }) => {
        setWorkDate(data.workDate || '');
        setWorkTimezone(data.workTimezone || '');
        setTeam(data.team || []);
      })
      .catch(() => {
        setError('Could not load team tasks.');
        setTeam([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  const openEmployeeCalendar = (row) => {
    const rawId = row.employeeId?._id ?? row.employeeId;
    if (!rawId) return;
    setCalendarSubject({ id: String(rawId), name: row.name });
    setCalendarOpen(true);
  };

  const closeEmployeeCalendar = () => {
    setCalendarOpen(false);
    setCalendarSubject(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-slate-700/80" />
          <div className="h-32 rounded-xl bg-slate-700/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Employee tasks</p>
          <p className="mt-1 text-sm text-slate-400">
            Work day <span className="font-medium text-slate-200">{workDate}</span>
            {workTimezone ? (
              <span className="text-slate-500"> · {workTimezone.replace(/_/g, ' ')}</span>
            ) : null}
          </p>
          <p className="mt-2 max-w-xl text-xs text-slate-500">
            Plans employees save from <span className="text-slate-400">Today&apos;s tasks</span> appear here for the
            current work day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {team.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-6 py-10 text-center text-sm text-slate-500">
          No employees in your team yet. Add people from <strong className="text-slate-400">Add employee</strong>.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {team.map((row) => {
            const text = planTextFromRow(row);
            const hasPlan = text.trim().length > 0;
            return (
              <li
                key={row.employeeId}
                className="flex flex-col rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 shadow-sm"
              >
                <div className="border-b border-slate-700/50 pb-3">
                  <button
                    type="button"
                    onClick={() => openEmployeeCalendar(row)}
                    title="View attendance calendar"
                    className="text-left font-medium text-slate-100 hover:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-sm"
                  >
                    {row.name}
                  </button>
                  <p className="mt-0.5 text-xs text-slate-500">{row.email}</p>
                </div>
                <div className="mt-4 min-h-16 flex-1">
                  {hasPlan ? (
                    <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-slate-300">{text}</p>
                  ) : (
                    <p className="text-sm italic text-slate-600">No plan saved for this work day yet.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AttendanceCalendarModal
        open={calendarOpen}
        onClose={closeEmployeeCalendar}
        workDate={workDate}
        workTimezoneLabel={workTimezone ? workTimezone.replace(/_/g, ' ') : ''}
        viewForEmployeeId={calendarSubject?.id}
        employeeName={calendarSubject?.name}
      />
    </div>
  );
}
