import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import ErpLogo from '../components/ErpLogo';

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
    <div className="erp-page-auth relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 sm:p-8">
      <div className="absolute left-4 top-4 flex w-[calc(100%-2rem)] items-start justify-between sm:left-6 sm:top-6 sm:w-[calc(100%-3rem)]">
        <Link
          to="/"
          className="inline-flex shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          aria-label="Home"
        >
          <ErpLogo className="h-8 w-8 shrink-0 rounded-md" />
        </Link>
        <ThemeToggle />
      </div>
      <div className="erp-panel-auth relative w-full max-w-[440px] shrink-0 p-6 sm:p-10">
        <Link to="/" className="erp-link mb-6 inline-flex text-sm font-medium">
          ← Back
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Sign in</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {role ? `Continue as ${role.charAt(0).toUpperCase() + role.slice(1)}` : 'Enter your credentials'}
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="erp-input"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="erp-input"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full cursor-pointer rounded-xl bg-sky-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
