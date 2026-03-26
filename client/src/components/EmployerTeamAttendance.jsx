import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AttendanceCalendarModal from './AttendanceCalendarModal';

function formatClock(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(att) {
  if (!att?.durationMinutes && att?.durationMinutes !== 0) return '—';
  const m = att.durationMinutes;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

function statusLabel(row) {
  const att = row.attendance;
  if (att?.startedAt) {
    if (!att.endedAt) return { text: 'In session', tone: 'emerald' };
    return { text: 'Completed', tone: 'blue' };
  }
  if (row.leaveToday === 'approved') return { text: 'On leave', tone: 'amber' };
  if (row.leaveToday === 'pending') return { text: 'Leave pending', tone: 'amber' };
  return { text: 'Not logged in', tone: 'slate' };
}

const toneClasses = {
  slate: 'bg-slate-700/50 text-slate-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
  blue: 'bg-blue-500/20 text-blue-300',
  amber: 'bg-amber-500/20 text-amber-200',
};

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function attendanceId(att) {
  if (!att) return null;
  return att._id || att.id;
}

export default function EmployerTeamAttendance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [workTimezone, setWorkTimezone] = useState('');
  const [team, setTeam] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [loginLocal, setLoginLocal] = useState('');
  const [logoutLocal, setLogoutLocal] = useState('');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
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
        setError('Could not load team attendance.');
        setTeam([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  const openEdit = (row) => {
    const att = row.attendance;
    const aid = attendanceId(att);
    if (!aid) return;
    setEditRow({ ...row, attendanceId: aid });
    setLoginLocal(toDatetimeLocalValue(att.startedAt));
    setLogoutLocal(att.endedAt ? toDatetimeLocalValue(att.endedAt) : '');
    setSessionOpen(!att.endedAt);
    setSaveError('');
  };

  const closeEdit = () => {
    setEditRow(null);
    setSaveError('');
  };

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

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editRow?.attendanceId) return;
    if (!loginLocal.trim()) {
      setSaveError('Login time is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const startedAt = new Date(loginLocal).toISOString();
      const endedAt = sessionOpen ? null : logoutLocal.trim() ? new Date(logoutLocal).toISOString() : null;
      if (!sessionOpen && logoutLocal.trim() && new Date(logoutLocal) < new Date(loginLocal)) {
        setSaveError('Logout must be after login.');
        setSaving(false);
        return;
      }
      await axios.patch(`/api/employer/attendance/${editRow.attendanceId}`, { startedAt, endedAt });
      closeEdit();
      await load();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Team attendance</p>
          <p className="mt-1 text-sm text-slate-400">
            Work day <span className="font-medium text-slate-200">{workDate}</span>
            {workTimezone ? (
              <span className="text-slate-500"> · {workTimezone.replace(/_/g, ' ')}</span>
            ) : null}
          </p>
          <p className="mt-2 max-w-xl text-xs text-slate-500">
            Use Edit to correct login/logout times. The employee gets an in-app notification when attendance is updated.
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
        <div className="overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-800/40">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700/80 bg-slate-900/50">
                <th className="px-4 py-3 font-semibold text-slate-400">Employee</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Login</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Logout</th>
                <th className="px-4 py-3 font-semibold text-slate-400">Duration</th>
                <th className="px-4 py-3 font-semibold text-slate-400"> </th>
              </tr>
            </thead>
            <tbody>
              {team.map((row) => {
                const att = row.attendance;
                const st = statusLabel(row);
                const aid = attendanceId(att);
                return (
                  <tr key={row.employeeId} className="border-b border-slate-800/80 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEmployeeCalendar(row)}
                        title="View attendance calendar"
                        className="block text-left font-medium text-slate-100 hover:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-sm"
                      >
                        {row.name}
                      </button>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[st.tone]}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatClock(att?.startedAt)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatClock(att?.endedAt)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatDuration(att)}</td>
                    <td className="px-4 py-3">
                      {aid ? (
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-lg border border-slate-600 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AttendanceCalendarModal
        open={calendarOpen}
        onClose={closeEmployeeCalendar}
        workDate={workDate}
        workTimezoneLabel={workTimezone ? workTimezone.replace(/_/g, ' ') : ''}
        viewForEmployeeId={calendarSubject?.id}
        employeeName={calendarSubject?.name}
      />

      {editRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-att-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 id="edit-att-title" className="text-lg font-semibold text-slate-100">
              Edit attendance
            </h2>
            <p className="mt-1 text-sm text-slate-500">{editRow.name}</p>
            <p className="mt-0.5 text-xs text-slate-600">Work day {workDate}</p>

            <form onSubmit={submitEdit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Login time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={loginLocal}
                  onChange={(e) => setLoginLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="session-open"
                  type="checkbox"
                  checked={sessionOpen}
                  onChange={(e) => {
                    setSessionOpen(e.target.checked);
                    if (e.target.checked) setLogoutLocal('');
                  }}
                  className="rounded border-slate-600 bg-slate-950 text-blue-600"
                />
                <label htmlFor="session-open" className="text-sm text-slate-300">
                  Still in session (no logout time yet)
                </label>
              </div>
              {!sessionOpen && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Logout time
                  </label>
                  <input
                    type="datetime-local"
                    value={logoutLocal}
                    onChange={(e) => setLogoutLocal(e.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              )}

              {saveError && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save & notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
