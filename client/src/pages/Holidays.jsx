import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppShell from '../components/AppShell';
import DatePickerField from '../components/DatePickerField';
import { useAuth } from '../context/AuthContext';

function toInputDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function Holidays() {
  const { isEmployer } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get('/api/holidays')
      .then(({ data }) => setHolidays(data.holidays || []))
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!deleting) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && deleteBusyId !== deleting._id) {
        setDeleting(null);
        setDeleteError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleting, deleteBusyId]);

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setFormName('');
    setFormDate('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (h) => {
    setFormMode('edit');
    setEditingId(h._id);
    setFormName(h.name);
    setFormDate(toInputDate(h.date));
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) return;
    setFormOpen(false);
    setFormError('');
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);
    try {
      if (formMode === 'add') {
        await axios.post('/api/holidays', {
          name: formName.trim(),
          date: formDate,
        });
      } else if (editingId) {
        await axios.patch(`/api/holidays/${editingId}`, {
          name: formName.trim(),
          date: formDate,
        });
      }
      load();
      setFormOpen(false);
    } catch (err) {
      const data = err.response?.data;
      setFormError(data?.message || data?.errors?.[0]?.msg || 'Could not save holiday.');
    } finally {
      setFormSaving(false);
    }
  };

  const openDeleteConfirm = (h) => {
    setDeleting(h);
    setDeleteError('');
  };

  const closeDeleteConfirm = () => {
    if (deleting && deleteBusyId === deleting._id) return;
    setDeleting(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    setDeleteBusyId(deleting._id);
    try {
      await axios.delete(`/api/holidays/${deleting._id}`);
      load();
      setDeleting(null);
    } catch (err) {
      const data = err.response?.data;
      setDeleteError(data?.message || data?.errors?.[0]?.msg || 'Could not remove holiday.');
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Holidays</h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-500">Public holidays for your organization.</p>
          </div>
          {isEmployer && (
            <button
              type="button"
              onClick={openAdd}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Add holiday
            </button>
          )}
        </header>

        <div className="erp-card overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : holidays.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {isEmployer ? 'No holidays yet. Add your company’s public holidays.' : 'No holidays listed yet.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {holidays.map((h) => (
                <li
                  key={h._id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{h.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{formatDisplayDate(h.date)}</p>
                  </div>
                  {isEmployer && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deleteBusyId === h._id}
                        onClick={() => openDeleteConfirm(h)}
                        className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-50"
                      >
                        {deleteBusyId === h._id ? '…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {formOpen && isEmployer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="holiday-form-title"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/90 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="holiday-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formMode === 'add' ? 'Add holiday' : 'Edit holiday'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Name and the date it is observed.</p>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={submitForm} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Holiday name
                </label>
                <input
                  className="erp-input-inline"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Republic Day"
                />
              </div>
              <div>
                <DatePickerField
                  id="holiday-date"
                  label="Date"
                  value={formDate}
                  onChange={setFormDate}
                  variant="modal"
                  required
                />
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  disabled={formSaving}
                  onClick={closeForm}
                  className="flex-1 rounded-xl border border-slate-400/70 bg-slate-300/70 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-400/55 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {formSaving ? 'Saving…' : formMode === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && isEmployer && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-holiday-title"
          onClick={closeDeleteConfirm}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/90 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-holiday-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Remove holiday?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{deleting.name}</span> on{' '}
              {formatDisplayDate(deleting.date)} will be removed from the list.
            </p>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={deleteBusyId === deleting._id}
                onClick={closeDeleteConfirm}
                className="rounded-xl border border-slate-400/70 bg-slate-300/70 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-400/55 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:min-w-28"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusyId === deleting._id}
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60 sm:min-w-28"
              >
                {deleteBusyId === deleting._id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
