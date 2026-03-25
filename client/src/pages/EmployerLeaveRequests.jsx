import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AppShell from '../components/AppShell';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function EmployerLeaveRequests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    axios
      .get('/api/employer/leave-requests')
      .then(({ data }) => setRequests(data.requests || []))
      .catch(() => {
        setError('Could not load leave requests.');
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, action) => {
    setBusyId(String(id));
    setError('');
    try {
      await axios.patch(`/api/employer/leave-requests/${id}`, { action });
      await load();
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update request.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <AppShell title="Leave requests">
      <div className="min-w-0 space-y-4">
        <p className="text-sm text-slate-400">
          {pending.length > 0 ? (
            <>
              <span className="font-medium text-amber-200">{pending.length}</span> pending approval
            </>
          ) : (
            'No pending leave requests.'
          )}
        </p>

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8">
            <div className="h-4 w-1/2 rounded bg-slate-700/80" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-800/40">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/50">
                  <th className="px-4 py-3 font-semibold text-slate-400">Employee</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Dates</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Days</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-400"> </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/80 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{r.employeeName}</p>
                      <p className="text-xs text-slate-500">{r.employeeEmail}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-300">{r.leaveType}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{r.days}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-200'
                            : r.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-red-500/20 text-red-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === String(r.id)}
                            onClick={() => decide(r.id, 'approve')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === String(r.id)}
                            onClick={() => decide(r.id, 'reject')}
                            className="rounded-lg border border-red-500/60 bg-red-950/50 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-950/80 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {requests.some((r) => r.reason?.trim()) && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes from employees</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-400">
              {requests
                .filter((r) => r.reason?.trim())
                .map((r) => (
                  <li key={`${r.id}-reason`}>
                    <span className="font-medium text-slate-300">{r.employeeName}:</span> {r.reason}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
