import AppShell from '../components/AppShell';
import EmployerTeamAttendance from '../components/EmployerTeamAttendance';

export default function EmployerAttendance() {
  return (
    <AppShell title="Attendance">
      <div className="w-full min-w-0 flex-1">
        <EmployerTeamAttendance />
      </div>
    </AppShell>
  );
}
