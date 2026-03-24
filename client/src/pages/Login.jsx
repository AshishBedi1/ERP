import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full rounded-xl border border-white/15 bg-slate-900 py-3.5 px-4 text-base text-slate-100 transition-all placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-[3px] focus:ring-sky-500/20';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, role);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-900 p-8">
      <span className="absolute left-6 top-6 text-lg font-bold tracking-tight text-slate-200">ERP</span>
      <div className="relative w-full max-w-[440px] shrink-0 rounded-2xl border border-white/10 bg-slate-900 p-10">
        <Link to="/" className="mb-6 inline-flex text-sm font-medium text-sky-400 hover:text-sky-300">
          ← Back
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-slate-100">Sign in</h1>
        <p className="text-sm text-slate-400">
          {role ? `Continue as ${role.charAt(0).toUpperCase() + role.slice(1)}` : 'Enter your credentials'}
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full cursor-pointer rounded-xl bg-sky-500 py-3.5 text-base font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
