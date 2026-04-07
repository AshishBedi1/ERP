import AppShell from '../components/AppShell';
import EmployeeTodayTasks from '../components/EmployeeTodayTasks';
import EmployeeTaskHistory from '../components/EmployeeTaskHistory';

export default function Tasks() {
  return (
    <AppShell title="Tasks">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-10">
        <EmployeeTodayTasks />
        <EmployeeTaskHistory />
      </div>
    </AppShell>
  );
}
