import AppShell from '../components/AppShell';
import EmployeeAttendance from '../components/EmployeeAttendance';

export default function Attendance() {
  return (
    <AppShell title="Attendance">
      <div className="w-full min-w-0 flex-1">
        <EmployeeAttendance />
      </div>
    </AppShell>
  );
}
