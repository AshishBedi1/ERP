import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmployerIllustration, EmployeeIllustration } from '../components/RoleIllustrations';
import ThemeToggle from '../components/ThemeToggle';
import ErpLogo from '../components/ErpLogo';

const ROLES = [
  { id: 'employer', label: 'Employer', Icon: EmployerIllustration },
  { id: 'employee', label: 'Employee', Icon: EmployeeIllustration },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSelect = (roleId) => {
    navigate(`/login?role=${roleId}`);
  };

  return (
    <div className="erp-page-auth relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">
      <div className="absolute left-6 top-6 flex w-[calc(100%-3rem)] items-start justify-between">
        <Link to="/" className="inline-flex shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-lg" aria-label="Home">
          <ErpLogo className="h-8 w-8 shrink-0 rounded-md" />
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Choose how you&apos;re signing in</p>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-5 md:grid-cols-2">
        {ROLES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-300/80 bg-slate-200/70 text-center shadow-sm shadow-slate-400/30 transition hover:border-slate-400 hover:bg-slate-300/60 dark:border-white/10 dark:bg-slate-900 dark:shadow-none dark:hover:border-white/25 dark:hover:bg-slate-900"
            onClick={() => handleSelect(id)}
          >
            <div className="flex h-[140px] items-center justify-center bg-slate-300/45 p-4 dark:bg-slate-900">
              <Icon />
            </div>
            <div className="border-t border-slate-300/80 py-5 dark:border-white/10">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{label}</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
        New company?{' '}
        <Link to="/register" className="erp-link font-medium">
          Register as employer
        </Link>
      </p>
      <p className="mt-2 max-w-sm text-center text-xs text-slate-500 dark:text-slate-500">
        Employees join only with an invite link from your employer.
      </p>
    </div>
  );
}
