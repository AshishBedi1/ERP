import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ThemeToggle from '../components/ThemeToggle';

export default function Register() {
  const [searchParams] = useSearchParams();
  const employerIdFromUrl = searchParams.get('employer');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employerInfo, setEmployerInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const isEmployeeInvite = Boolean(employerIdFromUrl);

  useEffect(() => {
    if (employerIdFromUrl) {
      axios
        .get(`/api/employer/public/${employerIdFromUrl}`)
        .then(({ data }) => setEmployerInfo(data.employer))
        .catch(() => setEmployerInfo(null));
    }
  }, [employerIdFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEmployeeInvite) {
        if (!employerIdFromUrl) {
          setError('Invalid invite link.');
          setLoading(false);
          return;
        }
        await register({
          name,
          email,
          password,
          role: 'employee',
          employerId: employerIdFromUrl,
        });
      } else {
        if (!companyName.trim()) {
          setError('Company name is required.');
          setLoading(false);
          return;
        }
        await register({
          name,
          email,
          password,
          role: 'employer',
          companyName: companyName.trim(),
        });
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="erp-page-auth relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 sm:p-8">
      <div className="absolute left-4 top-4 flex w-[calc(100%-2rem)] items-start justify-between sm:left-6 sm:top-6 sm:w-[calc(100%-3rem)]">
        <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-200">ERP</span>
        <ThemeToggle />
      </div>
      <div className="erp-panel-auth w-full max-w-[440px] shrink-0 p-6 sm:p-10">
        {isEmployeeInvite ? (
          <>
            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Join as employee</h1>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              {employerInfo
                ? `${employerInfo.companyName || employerInfo.name} invited you`
                : 'Complete your account'}
            </p>
            {employerInfo && (
              <div className="mb-6 rounded-lg bg-sky-100 px-3 py-2 text-sm text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">
                {employerInfo.companyName || employerInfo.name}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Register your company</h1>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Create an employer account for your team</p>
          </>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!isEmployeeInvite && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
                className="erp-input"
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Full name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="erp-input"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="erp-input"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              minLength={6}
              required
              className="erp-input"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-sky-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {loading ? 'Creating account...' : isEmployeeInvite ? 'Create account' : 'Register company'}
          </button>
        </form>

        <p className="mt-7 border-t border-slate-200 pt-6 text-center text-sm text-slate-600 dark:border-white/10 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="erp-link font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
