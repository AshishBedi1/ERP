import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function formatWorkDateLabel(ymd) {
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

function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EmployerTeamTaskHistory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [rangeMeta, setRangeMeta] = useState({ from: '', to: '', workTimezone: '' });
  const [team, setTeam] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);

  useEffect(() => {
    axios
      .get('/api/employer/employees')
      .then(({ data }) => setEmployeeOptions(data.employees || []))
      .catch(() => setEmployeeOptions([]));
  }, []);

  const load = useCallback((fromQ, toQ, employeeIdQ) => {
    setError('');
    setLoading(true);
    const params = {};
    if (fromQ) params.from = fromQ;
    if (toQ) params.to = toQ;
    if (employeeIdQ) params.employeeId = employeeIdQ;
    axios
      .get('/api/employer/tasks/history', { params })
      .then(({ data }) => {
        setRangeMeta({
          from: data.from || '',
          to: data.to || '',
          workTimezone: data.workTimezone || '',
        });
        setTeam(Array.isArray(data.team) ? data.team : []);
        if (!fromQ && !toQ) {
          setFrom(data.from || '');
          setTo(data.to || '');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load task history.');
        setTeam([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyRange = () => {
    if (!from || !to) {
      setError('Choose both start and end dates.');
      return;
    }
    if (from > to) {
      setError('Start date must be on or before end date.');
      return;
    }
    load(from, to, employeeFilter || undefined);
  };

  const resetDefault = () => {
    setFrom('');
    setTo('');
    setEmployeeFilter('');
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">History</p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-slate-100">Saved task plans by employee</p>
        <p className="mt-2 max-w-2xl text-xs text-slate-500">
          Browse plans your team saved from <span className="text-slate-400">Today&apos;s tasks</span> (any work day in
          the range). Default is the last 90 days.
          {rangeMeta.workTimezone ? (
            <span className="block mt-1">
              Work calendar:{' '}
              <span className="font-medium text-slate-400">
                {rangeMeta.workTimezone.replace(/_/g, ' ')}
              </span>
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="employer-history-from" className="text-xs font-medium text-slate-600">
            From
          </label>
          <input
            id="employer-history-from"
            type="date"
            value={from}
            max={to || todayLocalYmd()}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="employer-history-to" className="text-xs font-medium text-slate-600">
            To
          </label>
          <input
            id="employer-history-to"
            type="date"
            value={to}
            min={from || undefined}
            max={todayLocalYmd()}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="flex min-w-[200px] flex-col gap-1">
          <label htmlFor="employer-history-employee" className="text-xs font-medium text-slate-600">
            Employee
          </label>
          <select
            id="employer-history-employee"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All employees</option>
            {employeeOptions.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name} ({emp.email})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => applyRange()}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition hover:bg-sky-500 disabled:opacity-60"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => resetDefault()}
          disabled={loading}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
        >
          Last 90 days · all
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 rounded bg-slate-700/80" />
            <div className="h-24 rounded-xl bg-slate-700/50" />
          </div>
        </div>
      ) : team.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-6 py-10 text-center text-sm text-slate-500">
          No employees in your team yet, or no matching plans in this range.
        </div>
      ) : (
        <ul className="space-y-6">
          {team.map((row) => (
            <li
              key={String(row.employeeId)}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 shadow-sm"
            >
              <div className="border-b border-slate-700/50 pb-3">
                <p className="font-medium text-slate-100">{row.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{row.email}</p>
              </div>
              {!row.items || row.items.length === 0 ? (
                <p className="mt-4 text-sm italic text-slate-600">No saved plans in this date range.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {row.items.map((item) => (
                    <li
                      key={`${row.employeeId}-${item.workDate}`}
                      className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {formatWorkDateLabel(item.workDate)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        <span className="font-mono text-slate-500">{item.workDate}</span>
                      </p>
                      <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-slate-300">
                        {item.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
