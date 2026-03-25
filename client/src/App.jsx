import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

import RoleSelect from './pages/RoleSelect';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EmployerAddEmployee from './pages/EmployerAddEmployee';
import EmployerTeam from './pages/EmployerTeam';
import EmployerAttendance from './pages/EmployerAttendance';
import EmployerTasks from './pages/EmployerTasks';
import EmployerLeaveRequests from './pages/EmployerLeaveRequests';
import Holidays from './pages/Holidays';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Notifications from './pages/Notifications';
import Tasks from './pages/Tasks';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/holidays"
        element={
          <ProtectedRoute>
            <Holidays />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute roles={['employee']}>
            <Attendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute roles={['employee']}>
            <Leave />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute roles={['employee']}>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute roles={['employee', 'employer']}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/attendance"
        element={
          <ProtectedRoute roles={['employer']}>
            <EmployerAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/tasks"
        element={
          <ProtectedRoute roles={['employer']}>
            <EmployerTasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/leave-requests"
        element={
          <ProtectedRoute roles={['employer']}>
            <EmployerLeaveRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/team"
        element={
          <ProtectedRoute roles={['employer']}>
            <EmployerTeam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/add-employee"
        element={
          <ProtectedRoute roles={['employer']}>
            <EmployerAddEmployee />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
