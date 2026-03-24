import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export const EMPLOYER_TEAM_REFRESH = 'employer-team-refresh';

function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const navClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
  }`;

export default function AppShell({ children, title }) {
  const { user, logout, isEmployer, isEmployee } = useAuth();
  const roleLabel = isEmployer ? 'Employer' : 'Employee';
  const [team, setTeam] = useState([]);

  useEffect(() => {
    if (!isEmployer) {
      setTeam([]);
      return;
    }
    const load = () => {
      axios
        .get('/api/employer/employees')
        .then(({ data }) => setTeam(data.employees || []))
        .catch(() => setTeam([]));
    };
    load();
    window.addEventListener(EMPLOYER_TEAM_REFRESH, load);
    return () => window.removeEventListener(EMPLOYER_TEAM_REFRESH, load);
  }, [isEmployer]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-900">
      <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800/80 bg-slate-900 text-white">
        <div className="shrink-0 border-b border-slate-700/80 px-5 py-6">
          <span className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-slate-100">
            {user?.companyName?.trim() || 'Company'}
          </span>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 p-3">
          <NavLink to="/dashboard" className={navClass} end>
            <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25H15.75a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/holidays" className={navClass}>
            <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
            </svg>
            Holidays
          </NavLink>
          {isEmployee && (
            <>
              <NavLink to="/attendance" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Attendance
              </NavLink>
              <NavLink to="/leave" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
                Leave
              </NavLink>
            </>
          )}
          {isEmployer && (
            <>
              <NavLink to="/employer/team" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766m9.723-4.042a4.126 4.126 0 00-5.163 0m5.163 0a4.125 4.125 0 01-5.163 0m5.163 0h.007M12 12a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
                <span className="min-w-0 flex-1">Your team</span>
                {team.length > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-slate-700/90 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                    {team.length}
                  </span>
                )}
              </NavLink>
              <NavLink to="/employer/add-employee" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                Add employee
              </NavLink>
            </>
          )}
        </nav>

        <div className="mt-auto shrink-0 border-t border-slate-700/80 p-3">
          <div className="rounded-lg bg-slate-800/60 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
                {initials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{user?.name}</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    isEmployer ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-900">
        <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-slate-800 bg-slate-900 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-900 p-4 sm:p-8">
          {title && (
            <h1 className="mb-4 shrink-0 text-xl font-semibold tracking-tight text-slate-100 sm:mb-6">{title}</h1>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </main>
      </div>
    </div>
  );
}
