import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard';
import EmployerDashboard from '../components/dashboard/EmployerDashboard';

export default function Dashboard() {
  const { isEmployer, isEmployee } = useAuth();

  return (
    <AppShell title="Dashboard">
      <div className="min-w-0">
        {isEmployer && <EmployerDashboard />}
        {isEmployee && <EmployeeDashboard />}
        {!isEmployer && !isEmployee && <p className="text-sm text-slate-600 dark:text-slate-500">Loading…</p>}
      </div>
    </AppShell>
  );
}
