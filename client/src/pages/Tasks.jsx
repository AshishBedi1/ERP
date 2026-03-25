import AppShell from '../components/AppShell';
import EmployeeTodayTasks from '../components/EmployeeTodayTasks';

export default function Tasks() {
  return (
    <AppShell title="Today's tasks">
      <div className="w-full min-w-0 flex-1">
        <EmployeeTodayTasks />
      </div>
    </AppShell>
  );
}
