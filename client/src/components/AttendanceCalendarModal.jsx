import { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';

function parseWorkYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function statusCellClass(status, isFuture) {
  if (isFuture) {
    return 'bg-slate-200/50 ring-1 ring-slate-300/70 dark:bg-slate-800/40 dark:ring-slate-700/40';
  }
  switch (status) {
    case 'present':
      return 'bg-blue-500/85 shadow-sm shadow-blue-900/40 ring-1 ring-blue-400/30';
    case 'absent':
      return 'bg-red-500/80 shadow-sm shadow-red-900/40 ring-1 ring-red-400/25';
    case 'leave':
      return 'bg-emerald-500/80 shadow-sm shadow-emerald-900/40 ring-1 ring-emerald-400/30';
    default:
      return 'bg-slate-200/90 ring-1 ring-slate-300/70 dark:bg-slate-700/55 dark:ring-slate-600/40';
  }
}

function statusLabel(status, isFuture) {
  if (isFuture) return 'Future day';
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'leave':
      return 'Leave';
    default:
      return 'No record / weekend / today';
  }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AttendanceCalendarModal({
  open,
  onClose,
  workDate,
  workTimezoneLabel,
  /** When set, loads GET /api/attendance/team/:id/calendar (employer view). */
  viewForEmployeeId,
  /** Shown in title when viewing a team member's calendar. */
  employeeName,
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
  const [dayStatuses, setDayStatuses] = useState(new Map());
  const [todayWorkDate, setTodayWorkDate] = useState('');
  const [resolvedTimezoneLabel, setResolvedTimezoneLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    const p = parseWorkYmd(workDate);
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
    } else {
      const n = new Date();
      setViewYear(n.getFullYear());
      setViewMonth(n.getMonth() + 1);
    }
  }, [open, workDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCalLoading(true);
    setCalError('');
    const id = viewForEmployeeId ? encodeURIComponent(String(viewForEmployeeId)) : '';
    const url = viewForEmployeeId
      ? `/api/attendance/team/${id}/calendar?year=${viewYear}&month=${viewMonth}`
      : `/api/attendance/calendar?year=${viewYear}&month=${viewMonth}`;
    axios
      .get(url)
      .then(({ data }) => {
        if (cancelled || !data?.days) return;
        setDayStatuses(new Map(data.days.map((d) => [d.date, d.status])));
        setTodayWorkDate(data.todayWorkDate || '');
        if (data.workTimezone) {
          setResolvedTimezoneLabel(String(data.workTimezone).replace(/_/g, ' '));
        } else {
          setResolvedTimezoneLabel('');
        }
      })
      .catch(() => {
        if (!cancelled) setCalError('Could not load calendar.');
      })
      .finally(() => {
        if (!cancelled) setCalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, viewYear, viewMonth, viewForEmployeeId]);

  const timezoneSubtitle = workTimezoneLabel || resolvedTimezoneLabel;

  const monthTitle = useMemo(() => {
    return new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  const monthGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < pad; i++) cells.push({ type: 'pad' });
    for (let d = 1; d <= lastDay; d++) {
      const m = String(viewMonth).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      const ymd = `${viewYear}-${m}-${day}`;
      const status = dayStatuses.get(ymd) ?? 'none';
      cells.push({ type: 'day', d, ymd, status });
    }
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [viewYear, viewMonth, dayStatuses]);

  const goPrev = useCallback(() => {
    setViewMonth((m) => {
      if (m <= 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setViewMonth((m) => {
      if (m >= 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm dark:bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="att-cal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(90dvh,900px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-300/80 bg-slate-200/90 shadow-2xl dark:border-slate-600/60 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-300/80 bg-slate-200/90 px-5 py-4 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          <div>
            <h2 id="att-cal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {employeeName ? (
                <>
                  <span className="block text-base text-slate-600 dark:text-slate-400">Attendance</span>
                  {employeeName}
                </>
              ) : (
                'Attendance calendar'
              )}
            </h2>
            {timezoneSubtitle && (
              <p className="mt-0.5 text-xs text-slate-500">Work days use {timezoneSubtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-2.5 py-1 text-sm text-slate-800 transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-3 py-1.5 text-sm text-slate-800 shadow-sm hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Previous month"
              >
                ←
              </button>
              <p className="text-center text-sm font-semibold text-slate-800 dark:text-slate-200">{monthTitle}</p>
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-3 py-1.5 text-sm text-slate-800 shadow-sm hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Next month"
              >
                →
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            {calLoading && <p className="mt-4 text-center text-sm text-slate-500">Loading…</p>}
            {calError && (
              <p className="mt-4 text-center text-sm text-red-300" role="alert">
                {calError}
              </p>
            )}

            {!calLoading && !calError && (
              <div className="mt-2 space-y-1">
                {monthGrid.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-1">
                    {row.map((cell, ci) => {
                      if (cell.type === 'pad') {
                        return <div key={`p-${ri}-${ci}`} className="aspect-square min-h-8" />;
                      }
                      const isToday = cell.ymd === todayWorkDate;
                      const st = cell.status;
                      const isFuture = cell.ymd > todayWorkDate;
                      return (
                        <div
                          key={cell.ymd}
                          title={`${cell.ymd} — ${statusLabel(st, isFuture)}`}
                          className={`flex aspect-square min-h-8 flex-col items-center justify-center rounded-md text-[11px] font-medium ${statusCellClass(st, isFuture)} ${isToday ? 'ring-2 ring-amber-400/70' : ''}`}
                        >
                          <span className={isFuture ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}>{cell.d}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-[11px] text-slate-600 dark:border-slate-700/50 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/85 ring-1 ring-blue-400/30" /> Present
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80 ring-1 ring-red-400/25" /> Absent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80 ring-1 ring-emerald-400/30" /> Leave
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 ring-1 ring-slate-400/60 dark:bg-slate-700/55 dark:ring-slate-600/40" />{' '}
              None / weekend / today
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
