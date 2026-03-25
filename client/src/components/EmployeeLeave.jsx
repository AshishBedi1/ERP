import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const shellClass =
  'relative rounded-3xl border border-slate-200/90 bg-gradient-to-b from-stone-50 via-slate-50 to-slate-100 shadow-xl shadow-slate-300/40 ring-1 ring-slate-200/70 dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-950 dark:shadow-black/50 dark:ring-white/[0.06]';

function formatShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick leave' },
  { value: 'casual', label: 'Casual leave' },
  { value: 'earned', label: 'Earned leave' },
];

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
      />
    </svg>
  );
}

function maxYmd(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function DatePickerField({ id, label, value, onChange, min }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="w-full min-w-0 sm:w-auto sm:min-w-[11rem]">
      <label htmlFor={id} className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          {...(min ? { min } : {})}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[44px] cursor-pointer rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-3 pr-12 text-sm text-slate-100 [color-scheme:dark] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
        <button
          type="button"
          onClick={openPicker}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label={`Open calendar for ${label}`}
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}

function BucketCard({ title, sub, entitlement, pending, approved, remaining, tone }) {
  const tones = {
    slate: 'border-slate-600/50 bg-slate-950/50',
    amber: 'border-amber-500/25 bg-amber-950/20',
    emerald: 'border-emerald-500/20 bg-emerald-950/20',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-2xl border px-5 py-4 ${t}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-50">{entitlement}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/50 pt-3 text-center text-[11px]">
        <div>
          <p className="text-slate-500">Pending</p>
          <p className="font-semibold tabular-nums text-amber-200/90">{pending}</p>
        </div>
        <div>
          <p className="text-slate-500">Approved</p>
          <p className="font-semibold tabular-nums text-emerald-200/90">{approved}</p>
        </div>
        <div>
          <p className="text-slate-500">Left</p>
          <p className="font-semibold tabular-nums text-slate-100">{remaining}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeLeave() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('casual');
  const [submitting, setSubmitting] = useState(false);

  const noEmployer = !user?.employerId;

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    return Promise.all([axios.get('/api/leave/summary'), axios.get('/api/leave/my-requests')])
      .then(([{ data: s }, { data: r }]) => {
        setSummary(s);
        setRequests(r.requests || []);
      })
      .catch(() => {
        setError('Could not load leave information.');
        setSummary(null);
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (noEmployer) {
      setLoading(false);
      return;
    }
    load();
  }, [load, noEmployer]);

  const minLeaveYmd = useMemo(() => {
    if (summary?.todayYmd) return summary.todayYmd;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [summary?.todayYmd]);

  useEffect(() => {
    setStartDate((prev) => (prev && prev < minLeaveYmd ? '' : prev));
    setEndDate((prev) => (prev && prev < minLeaveYmd ? '' : prev));
  }, [minLeaveYmd]);

  useEffect(() => {
    if (startDate && endDate && endDate < startDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate) {
      setError('Choose a start and end date.');
      return;
    }
    if (startDate < minLeaveYmd || endDate < minLeaveYmd) {
      setError('You cannot request leave for yesterday or earlier. Choose today or a future date.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/leave/request', { startDate, endDate, reason, leaveType });
      setStartDate('');
      setEndDate('');
      setReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`${shellClass} px-6 py-14 sm:px-10`}>
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-32 rounded-full bg-slate-700/80" />
          <div className="h-24 w-full rounded-2xl bg-slate-700/40" />
        </div>
      </div>
    );
  }

  if (noEmployer) {
    return (
      <div className={`${shellClass} px-6 py-10 sm:px-10`}>
        <p className="text-center text-sm text-slate-400">
          Leave balances will appear once your account is linked to your employer.
        </p>
      </div>
    );
  }

  const year = summary?.calendarYear ?? new Date().getFullYear();
  const s = summary;
  const phPolicy = s?.publicHolidaysPolicyCount ?? 15;
  const phListed = s?.publicHolidaysThisYear ?? 0;

  const sick = s?.sick ?? { entitlement: 5, pending: 0, approved: 0, remaining: 5 };
  const casual = s?.casual ?? { entitlement: 5, pending: 0, approved: 0, remaining: 5 };
  const earned = s?.earned ?? { entitlement: 8, pending: 0, approved: 0, remaining: 8 };

  return (
    <div className={shellClass}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-500/25 to-transparent" />

      <div className="border-b border-slate-700/50 px-6 py-5 sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Leave policy (appointment terms)</p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-slate-400">
          <li>
            <strong className="text-slate-200">Annual leave (calendar year):</strong> {sick.entitlement} sick,{' '}
            {casual.entitlement} casual, {earned.entitlement} earned; no carry-forward; unused may be paid out per company
            rules.
          </li>
          <li>
            <strong className="text-slate-200">Public holidays:</strong> policy {phPolicy} paid days/year;{' '}
            {phListed} configured in Holidays for {year}. Public holidays on leave days do not count as annual leave.
          </li>
          <li>
            <strong className="text-slate-200">Short leave:</strong> one 2-hour short leave per month (log with HR).
          </li>
        </ul>
      </div>

      <div className="px-6 py-7 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Balances — {year}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BucketCard
            title="Sick leave"
            sub="days / year"
            entitlement={sick.entitlement}
            pending={sick.pending}
            approved={sick.approved}
            remaining={sick.remaining}
            tone="slate"
          />
          <BucketCard
            title="Casual leave"
            sub="days / year"
            entitlement={casual.entitlement}
            pending={casual.pending}
            approved={casual.approved}
            remaining={casual.remaining}
            tone="amber"
          />
          <BucketCard
            title="Earned leave"
            sub="no carry-forward"
            entitlement={earned.entitlement}
            pending={earned.pending}
            approved={earned.approved}
            remaining={earned.remaining}
            tone="emerald"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-200">Request leave</h2>
          <p className="mt-1 text-xs text-slate-500">
            Dates use the company work calendar
            {summary?.workTimezone ? (
              <span className="text-slate-600"> ({summary.workTimezone.replace(/_/g, ' ')})</span>
            ) : null}
            . You can only select <strong className="font-medium text-slate-400">today or future dates</strong> — past days
            (including yesterday) cannot be requested here.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Give at least one day notice where possible. Sick leave: attach doctor&apos;s note when required.
          </p>
          <form onSubmit={submitRequest} className="mt-4 flex flex-col gap-4">
            <div className="max-w-md">
              <label htmlFor="leave-type" className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Leave type
              </label>
              <select
                id="leave-type"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
              >
                {LEAVE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
              <DatePickerField
                id="leave-start"
                label="From"
                value={startDate}
                min={minLeaveYmd}
                onChange={setStartDate}
              />
              <DatePickerField
                id="leave-end"
                label="To"
                value={endDate}
                min={startDate ? maxYmd(startDate, minLeaveYmd) : minLeaveYmd}
                onChange={setEndDate}
              />
              <div className="min-w-0 flex-1 lg:min-w-[200px]">
                <label htmlFor="leave-reason" className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Reason / notes
                </label>
                <input
                  id="leave-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={leaveType === 'sick' ? 'e.g. medical — doctor note to follow' : 'e.g. personal'}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>

        {requests.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-200">Your requests</h2>
            <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-700/60 bg-slate-950/40">
              {requests.map((req) => (
                <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="text-slate-300">
                    <span className="mr-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                      {req.leaveType || 'casual'}
                    </span>
                    {formatShortDate(req.startDate)}
                    {new Date(req.startDate).getTime() !== new Date(req.endDate).getTime() &&
                      ` – ${formatShortDate(req.endDate)}`}
                    <span className="ml-2 text-slate-500">({req.days} d)</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      req.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : req.status === 'rejected'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {req.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
