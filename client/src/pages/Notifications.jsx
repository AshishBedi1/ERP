import AppShell from '../components/AppShell';
import NotificationsPanel from '../components/NotificationsPanel';

export default function Notifications() {
  return (
    <AppShell title="Notifications">
      <div className="mx-auto min-w-0 max-w-3xl space-y-4">
        <NotificationsPanel />
      </div>
    </AppShell>
  );
}
