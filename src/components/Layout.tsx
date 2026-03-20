import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, AppWindow, LogOut } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { Navigate } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
    isActive
      ? 'bg-white/10 text-white'
      : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`;

// Layout wraps all authenticated pages. Also acts as the auth guard.
export default function Layout() {
  const { user, loading, signOut } = useUser();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0f172a] flex flex-col fixed inset-y-0 left-0 z-10">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <span className="text-[#f97316] text-xs font-black tracking-[3px] uppercase">
            LaunchRadar
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard size={15} />
            Dashboard
          </NavLink>
          <NavLink to="/apps" className={navLinkClass}>
            <AppWindow size={15} />
            My Apps
          </NavLink>
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-slate-400 text-xs truncate mb-2">{user.email}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content area */}
      <main className="ml-60 flex-1 bg-[#f8fafc] min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
