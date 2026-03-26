import { useState, useEffect, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

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
      : 'text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/90 dark:hover:text-white'
  }`;

function MenuIcon({ open }) {
  if (open) {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export default function AppShell({ children, title }) {
  const { user, logout, isEmployer, isEmployee } = useAuth();
  const location = useLocation();
  const roleLabel = isEmployer ? 'Employer' : 'Employee';
  const [team, setTeam] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadUnreadNotifications = useCallback(() => {
    if (!isEmployee && !isEmployer) {
      setUnreadNotifications(0);
      return;
    }
    axios
      .get('/api/notifications/unread-count')
      .then(({ data }) => setUnreadNotifications(data.count ?? 0))
      .catch(() => setUnreadNotifications(0));
  }, [isEmployee, isEmployer]);

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

  useEffect(() => {
    loadUnreadNotifications();
    const t = setInterval(loadUnreadNotifications, 45000);
    const onFocus = () => loadUnreadNotifications();
    const onUpdated = () => loadUnreadNotifications();
    window.addEventListener('focus', onFocus);
    window.addEventListener('notifications-updated', onUpdated);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('notifications-updated', onUpdated);
    };
  }, [loadUnreadNotifications]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const headerTitle = title || user?.companyName || 'Dashboard';
  const headerSubtitle = title && user?.companyName?.trim() ? user.companyName : null;

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-900">
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full min-h-0 w-[min(18rem,88vw)] shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-slate-300/90 bg-slate-200/90 text-slate-900 shadow-2xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 dark:text-white md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:shadow-none ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top bar: same height + border as main header so vertical divider meets horizontal rule cleanly */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 pt-[max(0px,env(safe-area-inset-top))] sm:px-4 dark:border-slate-800 md:h-16 md:px-6">
          <Link
            to="/dashboard"
            onClick={() => setMobileNavOpen(false)}
            className="line-clamp-2 min-w-0 flex-1 text-left text-base font-bold leading-tight tracking-tight text-slate-900 transition-colors hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-100 dark:hover:text-blue-200 md:text-lg"
          >
            {user?.companyName?.trim() || 'Company'}
          </Link>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-400/80 bg-slate-300/80 p-2 text-slate-700 md:hidden dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <MenuIcon open />
          </button>
        </div>
        <nav id="app-sidebar-nav" className="flex min-h-0 flex-1 flex-col gap-0.5 p-3" aria-label="Main navigation">
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
          <NavLink to="/notes" className={navClass}>
            <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            Important notes
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
              <NavLink to="/tasks" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Today&apos;s tasks
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
              <NavLink to="/notifications" className={navClass}>
                <span className="relative inline-flex">
                  <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900 tabular-nums">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </span>
                Notifications
              </NavLink>
            </>
          )}
          {isEmployer && (
            <>
              <NavLink to="/employer/attendance" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Attendance
              </NavLink>
              <NavLink to="/employer/tasks" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Tasks
              </NavLink>
              <NavLink to="/employer/leave-requests" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
                Leave requests
              </NavLink>
              <NavLink to="/notifications" className={navClass}>
                <span className="relative inline-flex">
                  <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900 tabular-nums">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </span>
                Notifications
              </NavLink>
              <NavLink to="/employer/team" className={navClass}>
                <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766m9.723-4.042a4.126 4.126 0 00-5.163 0m5.163 0a4.125 4.125 0 01-5.163 0m5.163 0h.007M12 12a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
                <span className="min-w-0 flex-1">Your team</span>
                {team.length > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-slate-300/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 tabular-nums dark:bg-slate-700/90 dark:text-slate-200">
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

        <div className="mt-auto shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-700/80">
          <div className="rounded-lg bg-slate-200/70 p-3 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                {initials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    isEmployer
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-slate-900">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-300/80 bg-slate-200/85 px-3 pt-[max(0px,env(safe-area-inset-top))] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 sm:gap-3 sm:px-4 md:h-16 md:px-6">
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-400/70 bg-slate-300/70 p-2 text-slate-800 transition hover:bg-slate-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar-nav"
            aria-label="Open menu"
          >
            <MenuIcon open={false} />
          </button>
          <div className="min-w-0 flex-1 md:hidden">
            {!title && user?.companyName?.trim() ? (
              <Link
                to="/dashboard"
                className="block truncate text-sm font-semibold leading-tight text-slate-900 transition-colors hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-200"
              >
                {headerTitle}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">{headerTitle}</p>
            )}
            {headerSubtitle && (
              <Link
                to="/dashboard"
                className="mt-0.5 block truncate text-xs text-slate-500 transition-colors hover:text-slate-600 dark:hover:text-slate-400"
              >
                {headerSubtitle}
              </Link>
            )}
          </div>
          <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {(isEmployee || isEmployer) && (
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `relative inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
                    isActive
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-400/70 bg-slate-300/70 text-slate-800 hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`
                }
                title="Notifications"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900 tabular-nums">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </NavLink>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-400/70 bg-slate-300/70 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-400/55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:bg-slate-900 sm:px-6 sm:pb-8 sm:pt-6 md:px-8 md:pb-8 md:pt-8">
          {title && (
            <h1 className="mb-4 hidden shrink-0 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:mb-6 md:block">
              {title}
            </h1>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">{children}</div>
        </main>
      </div>
    </div>
  );
}
