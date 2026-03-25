import AppShell from '../components/AppShell';
import EmployerTeamTasks from '../components/EmployerTeamTasks';

export default function EmployerTasks() {
  return (
    <AppShell title="Tasks">
      <div className="w-full min-w-0 flex-1">
        <EmployerTeamTasks />
      </div>
    </AppShell>
  );
}
