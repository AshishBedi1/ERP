import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmployerIllustration, EmployeeIllustration } from '../components/RoleIllustrations';

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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-900 px-4 py-12">
      <span className="absolute left-6 top-6 text-lg font-bold tracking-tight text-slate-200">ERP</span>
      <h1 className="text-2xl font-bold text-slate-100">Sign in</h1>
      <p className="mt-2 text-sm text-slate-400">Choose how you&apos;re signing in</p>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-5 md:grid-cols-2">
        {ROLES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-center transition hover:border-white/25 hover:bg-slate-900"
              onClick={() => handleSelect(id)}
            >
            <div className="flex h-[140px] items-center justify-center bg-slate-900 p-4">
              <Icon />
            </div>
            <div className="border-t border-white/10 py-5">
              <span className="text-base font-semibold text-slate-100">{label}</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-slate-400">
        New company?{' '}
        <Link to="/register" className="font-medium text-sky-400 hover:text-sky-300">
          Register as employer
        </Link>
      </p>
      <p className="mt-2 max-w-sm text-center text-xs text-slate-500">
        Employees join only with an invite link from your employer.
      </p>
    </div>
  );
}
