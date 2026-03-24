import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const inputClass =
  'w-full rounded-xl border border-white/15 bg-slate-900 py-3.5 px-4 text-base text-slate-100 transition-all placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-[3px] focus:ring-sky-500/20';

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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-900 p-8">
      <span className="absolute left-6 top-6 text-lg font-bold tracking-tight text-slate-200">ERP</span>
      <div className="w-full max-w-[440px] shrink-0 rounded-2xl border border-white/10 bg-slate-900 p-10">
        {isEmployeeInvite ? (
          <>
            <h1 className="mb-1 text-2xl font-bold text-slate-100">Join as employee</h1>
            <p className="mb-6 text-sm text-slate-400">
              {employerInfo
                ? `${employerInfo.companyName || employerInfo.name} invited you`
                : 'Complete your account'}
            </p>
            {employerInfo && (
              <div className="mb-6 rounded-lg bg-sky-500/20 px-3 py-2 text-sm text-sky-400">
                {employerInfo.companyName || employerInfo.name}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-slate-100">Register your company</h1>
            <p className="mb-6 text-sm text-slate-400">Create an employer account for your team</p>
          </>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!isEmployeeInvite && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-400">Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
                className={inputClass}
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-400">Full name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              minLength={6}
              required
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-sky-500 py-3.5 text-base font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : isEmployeeInvite ? 'Create account' : 'Register company'}
          </button>
        </form>

        <p className="mt-7 border-t border-white/10 pt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-sky-400 hover:text-sky-300">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
