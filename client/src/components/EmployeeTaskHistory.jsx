import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const shellClass =
  'relative overflow-hidden rounded-3xl border border-slate-300/80 bg-gradient-to-b from-slate-200/80 via-slate-100 to-slate-300/60 shadow-xl shadow-slate-400/30 ring-1 ring-slate-300/60 dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-950 dark:shadow-black/50 dark:ring-white/[0.06]';

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

export default function EmployeeTaskHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeMeta, setRangeMeta] = useState({ from: '', to: '', workTimezone: '' });
  const [items, setItems] = useState([]);

  const noEmployer = !user?.employerId;

  const load = useCallback(
    (fromQ, toQ) => {
      setError('');
      setLoading(true);
      const params = {};
      if (fromQ) params.from = fromQ;
      if (toQ) params.to = toQ;
      axios
        .get('/api/tasks/history', { params })
        .then(({ data }) => {
          setRangeMeta({
            from: data.from || '',
            to: data.to || '',
            workTimezone: data.workTimezone || '',
          });
          setItems(Array.isArray(data.items) ? data.items : []);
          if (!fromQ && !toQ) {
            setFrom(data.from || '');
            setTo(data.to || '');
          }
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Could not load history.');
          setItems([]);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    if (noEmployer) return;
    load();
  }, [load, noEmployer]);

  const applyRange = () => {
    if (!from || !to) {
      setError('Choose both start and end dates.');
      return;
    }
    if (from > to) {
      setError('Start date must be on or before end date.');
      return;
    }
    load(from, to);
  };

  const resetDefault = () => {
    setFrom('');
    setTo('');
    load();
  };

  if (noEmployer) {
    return null;
  }

  return (
    <div className="w-full max-w-none">
      <div className={`${shellClass} flex flex-col`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-500/30 to-transparent" />

        <div className="border-b border-slate-300/80 bg-slate-300/30 px-6 py-5 dark:border-slate-700/50 dark:bg-slate-900/30 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-500">History</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Past saved plans</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
            Every plan you saved is stored by work day. Pick a date range to browse (up to one year). Default is the last
            90 days.
            {rangeMeta.workTimezone ? (
              <span className="block mt-1 text-slate-500">
                Work calendar uses timezone:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {rangeMeta.workTimezone.replace(/_/g, ' ')}
                </span>
              </span>
            ) : null}
          </p>
        </div>

        <div className="px-6 py-6 sm:px-10">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="history-from" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                From
              </label>
              <input
                id="history-from"
                type="date"
                value={from}
                max={to || todayLocalYmd()}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-slate-400/70 bg-slate-200/50 px-3 py-2 text-sm text-slate-900 dark:border-slate-600/80 dark:bg-slate-950/80 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="history-to" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                To
              </label>
              <input
                id="history-to"
                type="date"
                value={to}
                min={from || undefined}
                max={todayLocalYmd()}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-slate-400/70 bg-slate-200/50 px-3 py-2 text-sm text-slate-900 dark:border-slate-600/80 dark:bg-slate-950/80 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => applyRange()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-60"
            >
              Apply range
            </button>
            <button
              type="button"
              onClick={() => resetDefault()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-400/70 bg-slate-300/70 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Last 90 days
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-slate-700/50" />
              <div className="h-24 rounded-xl bg-slate-700/40" />
            </div>
          ) : items.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No saved plans in this range. Plans appear here after you use <strong className="text-slate-400">Save plan</strong>{' '}
              on a given work day.
            </p>
          ) : (
            <ul className="mt-6 space-y-5">
              {items.map((row) => (
                <li
                  key={row.workDate}
                  className="rounded-2xl border border-slate-400/60 bg-slate-200/50 p-4 dark:border-slate-600/50 dark:bg-slate-950/50"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {formatWorkDateLabel(row.workDate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Work day <span className="font-mono text-slate-600 dark:text-slate-400">{row.workDate}</span>
                  </p>
                  <div className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {row.content}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
