import AppShell from '../components/AppShell';
import EmployeeLeave from '../components/EmployeeLeave';

export default function Leave() {
  return (
    <AppShell title="Leave">
      <div className="w-full min-w-0 flex-1">
        <EmployeeLeave />
      </div>
    </AppShell>
  );
}
