import AppShell from '../components/AppShell';
import EmployerTeamTasks from '../components/EmployerTeamTasks';
import EmployerTeamTaskHistory from '../components/EmployerTeamTaskHistory';

export default function EmployerTasks() {
  return (
    <AppShell title="Tasks">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-12">
        <EmployerTeamTasks />
        <EmployerTeamTaskHistory />
      </div>
    </AppShell>
  );
}
