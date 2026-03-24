import { useState } from 'react';
import axios from 'axios';
import AppShell, { EMPLOYER_TEAM_REFRESH } from '../components/AppShell';

const inputClass =
  'w-full rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 shadow-inner placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25';

const cardClass =
  'rounded-2xl border border-slate-700/80 bg-slate-800/50 shadow-lg shadow-black/20 backdrop-blur-sm';

export default function EmployerAddEmployee() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const body = { name, email };
      if (password.trim()) body.password = password;
      if (dateOfJoining.trim()) body.dateOfJoining = dateOfJoining;
      await axios.post('/api/employer/employees', body);
      setSuccess('Employee added successfully.');
      setName('');
      setEmail('');
      setPassword('');
      setDateOfJoining('');
      window.dispatchEvent(new Event(EMPLOYER_TEAM_REFRESH));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add employee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <header className="mb-8 border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Add employee</h1>
          <p className="mt-1.5 text-sm text-slate-500">Create an account so they can sign in with the email and password you set.</p>
        </header>

        <div className={`p-6 sm:p-8 ${cardClass}`}>
          {error && (
            <div className="mb-4 rounded-xl border border-red-800/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-800/60 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Date of joining <span className="font-normal normal-case text-slate-500">(optional)</span>
              </label>
              <input
                type="date"
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">Defaults to today if empty.</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="jane@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password <span className="font-normal normal-case text-slate-500">(optional)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Leave empty to let them set it later"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Adding…' : 'Add employee'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
