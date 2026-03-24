import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

import RoleSelect from './pages/RoleSelect';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EmployerAddEmployee from './pages/EmployerAddEmployee';
import EmployerTeam from './pages/EmployerTeam';
import Holidays from './pages/Holidays';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';

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
