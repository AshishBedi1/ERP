import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthHeader(token);
    try {
      const { data } = await axios.get(`${API_URL}/auth/me`);
      setUser(data.user);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password, role) => {
    const payload = { email, password };
    if (role === 'employer' || role === 'employee') payload.role = role;
    const { data } = await axios.post(`${API_URL}/auth/login`, payload);
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    const { data } = await axios.post(`${API_URL}/auth/register`, payload);
    localStorage.setItem('token', data.token);
    setAuthHeader(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAuthHeader(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isEmployer: user?.role === 'employer',
        isEmployee: user?.role === 'employee',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
