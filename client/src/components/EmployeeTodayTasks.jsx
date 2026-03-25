import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const shellClass =
  'relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-stone-50 via-slate-50 to-slate-100 shadow-xl shadow-slate-300/40 ring-1 ring-slate-200/70 dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-950 dark:shadow-black/50 dark:ring-white/[0.06]';

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

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

export default function EmployeeTodayTasks() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workDate, setWorkDate] = useState('');
  const [content, setContent] = useState('');
  const [baselineDraft, setBaselineDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const areaRef = useRef(null);
  const savedPreviewRef = useRef(null);
  const savedFlashTimerRef = useRef(null);
  /** null | 'remove-saved' | 'discard-draft' */
  const [confirmKind, setConfirmKind] = useState(null);

  const noEmployer = !user?.employerId;

  const persist = useCallback(async (text) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put('/api/tasks/today', { content: text });
      const next = typeof data.content === 'string' ? data.content : '';
      setLastSaved(next);
      setContent('');
      setBaselineDraft('');
      setWorkDate(data.workDate || '');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    axios
      .get('/api/tasks/today')
      .then(({ data }) => {
        const c = typeof data.content === 'string' ? data.content : '';
        setWorkDate(data.workDate || '');
        setContent(c);
        setBaselineDraft(c);
        setLastSaved(c);
      })
      .catch(() => {
        setError('Could not load today’s plan.');
        setContent('');
        setBaselineDraft('');
        setLastSaved('');
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

  useEffect(
    () => () => {
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!confirmKind) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setConfirmKind(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmKind]);

  const savePlanNow = useCallback(async () => {
    const ok = await persist(content);
    if (ok) {
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      setSavedFlash(true);
      savedFlashTimerRef.current = setTimeout(() => {
        savedFlashTimerRef.current = null;
        setSavedFlash(false);
      }, 2500);
      requestAnimationFrame(() => {
        savedPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [content, persist]);

  const editSavedIntoDraft = () => {
    if (!lastSaved.trim()) return;
    setContent(lastSaved);
    setBaselineDraft(lastSaved);
    setSavedFlash(false);
    requestAnimationFrame(() => {
      areaRef.current?.focus();
      const el = areaRef.current;
      if (el) {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      }
    });
  };

  const deleteOrDiscard = () => {
    if (lastSaved.trim()) {
      setConfirmKind('remove-saved');
      return;
    }
    if (content.trim()) {
      setConfirmKind('discard-draft');
    }
  };

  const closeConfirm = () => setConfirmKind(null);

  const runConfirm = () => {
    const kind = confirmKind;
    setConfirmKind(null);
    if (kind === 'remove-saved') {
      void persist('');
    } else if (kind === 'discard-draft') {
      setContent('');
      setBaselineDraft('');
      setSavedFlash(false);
    }
  };

  const dirty = content !== baselineDraft;

  const focusArea = () => {
    areaRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="w-full max-w-none">
        <div className={`${shellClass} px-6 py-10 sm:px-10`}>
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-32 rounded-full bg-slate-700/80" />
            <div className="h-24 rounded-xl bg-slate-700/50" />
          </div>
        </div>
      </div>
    );
  }

  if (noEmployer) {
    return (
      <div className="w-full max-w-none">
        <div className={`${shellClass} flex min-h-[200px] flex-col items-center justify-center px-6 py-10`}>
          <p className="text-center text-sm text-slate-400">
            Today’s plan will be available once your account is linked to your employer.
          </p>
        </div>
      </div>
    );
  }

  const canEditSaved = lastSaved.trim().length > 0;
  const canDelete = lastSaved.trim().length > 0 || content.trim().length > 0;

  return (
    <div className="w-full max-w-none">
      <div className={`${shellClass} flex flex-col`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-500/30 to-transparent" />

        <div className="border-b border-slate-700/50 bg-slate-900/30 px-6 py-5 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Today’s tasks</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-slate-50">What you’re working on</p>
          <p className="mt-1 text-xs text-slate-500">
            Work day <span className="font-medium text-slate-300">{formatWorkDateLabel(workDate)}</span> — write in the
            box above, then save. The box clears after save; your saved plan is shown below and sent to your employer on
            team attendance.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-10">
          <h2 className="mb-3 text-base font-semibold tracking-tight text-slate-100">Today&apos;s Plan:</h2>

          <label htmlFor="today-plan" className="sr-only">
            Today&apos;s plan
          </label>
          <textarea
            ref={areaRef}
            id="today-plan"
            value={content}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 10000) return;
              setContent(v);
              setSavedFlash(false);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                void savePlanNow();
              }
            }}
            placeholder="Write your plan for today…"
            rows={5}
            className="min-h-[120px] w-full resize-y rounded-xl border border-slate-600/80 bg-slate-950/80 px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
            spellCheck
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void savePlanNow()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <span className="text-xs text-slate-600" title="Keyboard shortcut">
              Ctrl+S / ⌘S
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {savedFlash ? (
              <span className="font-medium text-emerald-400/90">Plan saved</span>
            ) : saving ? (
              <span>Saving…</span>
            ) : dirty ? (
              <span className="font-medium text-amber-400/90">Unsaved changes</span>
            ) : content.trim() ? (
              <span>No unsaved changes</span>
            ) : (
              <span>Nothing to save</span>
            )}
            <span className="text-slate-600">{content.length} / 10000</span>
          </div>

          {lastSaved.trim().length > 0 && (
            <div ref={savedPreviewRef} className="mt-6 border-t border-slate-700/60 pt-6">
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Saved plan</p>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/95">
                  Sent to employer
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                The draft box above is cleared after you save. This is the copy your employer sees for today.
              </p>
              <div className="mt-3 rounded-2xl border border-slate-600/50 bg-slate-950/60 px-4 py-4 text-sm leading-relaxed text-slate-200 shadow-inner shadow-black/20">
                <p className="whitespace-pre-wrap wrap-break-word">{lastSaved}</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-6">
            <button
              type="button"
              disabled={!canEditSaved}
              onClick={editSavedIntoDraft}
              title={canEditSaved ? 'Load saved plan into the box above' : 'Save something first'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconPencil />
              Edit
            </button>
            <button
              type="button"
              disabled={!canDelete}
              onClick={deleteOrDiscard}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-red-900/50 hover:bg-red-950/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconTrash />
              {lastSaved.trim() ? 'Delete' : 'Clear draft'}
            </button>
            <button
              type="button"
              onClick={focusArea}
              className="ml-auto text-xs text-slate-500 underline decoration-slate-600 underline-offset-2 hover:text-slate-400"
            >
              Focus draft box
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>

      {confirmKind && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-plan-title"
            className="w-full max-w-md rounded-2xl border border-slate-600/80 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-plan-title" className="text-lg font-semibold text-slate-100">
              {confirmKind === 'remove-saved' ? 'Remove saved plan?' : 'Discard draft?'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {confirmKind === 'remove-saved'
                ? 'Your employer will no longer see this plan on team attendance for today’s work day.'
                : 'What you typed in the draft box will be lost. This does not remove an already saved plan below.'}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirm}
                className={
                  confirmKind === 'remove-saved'
                    ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40'
                    : 'rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40'
                }
              >
                {confirmKind === 'remove-saved' ? 'Remove' : 'Discard draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
