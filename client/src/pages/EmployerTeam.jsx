import { useState, useEffect } from 'react';
import axios from 'axios';
import AppShell, { EMPLOYER_TEAM_REFRESH } from '../components/AppShell';
import AttendanceCalendarModal from '../components/AttendanceCalendarModal';

function refreshTeam() {
  window.dispatchEvent(new Event(EMPLOYER_TEAM_REFRESH));
}

function toInputDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EmployerTeam() {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDoj, setEditDoj] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSubject, setCalendarSubject] = useState(null);
  const [workDateHint, setWorkDateHint] = useState('');

  useEffect(() => {
    const load = () => {
      axios
        .get('/api/employer/employees')
        .then(({ data }) => setEmployees(data.employees || []))
        .catch(() => setEmployees([]));
    };
    load();
    window.addEventListener(EMPLOYER_TEAM_REFRESH, load);
    return () => window.removeEventListener(EMPLOYER_TEAM_REFRESH, load);
  }, []);

  useEffect(() => {
    axios.get('/api/attendance/team-today').then(({ data }) => {
      setWorkDateHint(data.workDate || '');
    }).catch(() => setWorkDateHint(''));
  }, []);

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

  const openEdit = (emp) => {
    setEditing(emp);
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditPassword('');
    setEditDoj(toInputDate(emp.dateOfJoining));
    setEditError('');
  };

  const closeEdit = () => {
    setEditing(null);
    setEditError('');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setEditError('');
    setEditSaving(true);
    try {
      const body = { name: editName.trim(), email: editEmail.trim(), dateOfJoining: editDoj || null };
      if (editPassword.trim()) body.password = editPassword;
      await axios.patch(`/api/employer/employees/${editing._id}`, body);
      refreshTeam();
      closeEdit();
    } catch (err) {
      const data = err.response?.data;
      setEditError(data?.message || data?.errors?.[0]?.msg || 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const openDeleteConfirm = (emp) => {
    setDeleting(emp);
    setDeleteError('');
  };

  const closeDeleteConfirm = () => {
    if (deleting && deleteBusyId === deleting._id) return;
    setDeleting(null);
    setDeleteError('');
  };

  const openEmployeeCalendar = (emp) => {
    setCalendarSubject({ id: String(emp._id), name: emp.name });
    setCalendarOpen(true);
  };

  const closeEmployeeCalendar = () => {
    setCalendarOpen(false);
    setCalendarSubject(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    setDeleteBusyId(deleting._id);
    try {
      await axios.delete(`/api/employer/employees/${deleting._id}`);
      refreshTeam();
      setDeleting(null);
    } catch (err) {
      const data = err.response?.data;
      setDeleteError(data?.message || data?.errors?.[0]?.msg || 'Could not remove this person.');
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Your team</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-500">People in your organization</p>
        </header>

        <div className="erp-card overflow-hidden">
          {employees.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No employees yet</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {employees.map((emp) => (
                <li
                  key={emp._id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openEmployeeCalendar(emp)}
                      title="View attendance calendar"
                      className="block rounded-sm text-left font-medium text-slate-900 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-100 dark:hover:text-blue-300"
                    >
                      {emp.name}
                    </button>
                    <p className="truncate text-sm text-slate-600 dark:text-slate-400">{emp.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusyId === emp._id}
                      onClick={() => openDeleteConfirm(emp)}
                      className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/70 disabled:opacity-50"
                    >
                      {deleteBusyId === emp._id ? '…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-employee-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/90 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="edit-employee-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Edit employee
            </h2>
            <p className="mt-1 text-sm text-slate-500">Update their details or set a new password.</p>

            {editError && (
              <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {editError}
              </div>
            )}

            <form onSubmit={saveEdit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Full name
                </label>
                <input
                  className="erp-input-inline"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Work email
                </label>
                <input
                  type="email"
                  className="erp-input-inline"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Date of joining
                </label>
                <input
                  type="date"
                  className="erp-input-inline"
                  value={editDoj}
                  onChange={(e) => setEditDoj(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">HR record (e.g. for service length).</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  New password <span className="font-normal normal-case text-slate-500">(optional)</span>
                </label>
                <input
                  type="password"
                  className="erp-input-inline"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-xl border border-slate-400/70 bg-slate-300/70 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AttendanceCalendarModal
        open={calendarOpen}
        onClose={closeEmployeeCalendar}
        workDate={workDateHint}
        viewForEmployeeId={calendarSubject?.id}
        employeeName={calendarSubject?.name}
      />

      {deleting && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-employee-title"
          aria-describedby="delete-employee-desc"
          onClick={closeDeleteConfirm}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300/80 bg-slate-200/90 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-employee-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Remove from team?
            </h2>
            <p id="delete-employee-desc" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{deleting.name}</span> will be removed from
              your
              organization. They will no longer be able to sign in with this account.
            </p>
            <p className="mt-2 text-xs text-slate-500">{deleting.email}</p>

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
