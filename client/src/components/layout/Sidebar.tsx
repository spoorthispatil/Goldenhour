import { LogOut, ShieldCheck, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Brand } from './Brand';
import {
  DISPATCHER_NAV,
  HOSPITAL_NAV,
  PATIENT_NAV,
} from '../../lib/navigation';
import type { UserRole } from '../../lib/auth';
import { useAuth } from '../../lib/auth';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role: UserRole = user?.role ?? 'DISPATCHER';
  const sections =
    role === 'DISPATCHER'
      ? DISPATCHER_NAV
      : role === 'PATIENT'
        ? PATIENT_NAV
        : HOSPITAL_NAV;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-navy-950/50 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-navy-700/60 bg-navy-900 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Brand inverted subtitle="Command Platform" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-5 mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
            <ShieldCheck size={12} /> Signed in as
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold text-white">
            {user?.username ?? 'Unknown'}
          </p>
          <p className="truncate text-[11px] text-white/45">
            {role === 'DISPATCHER'
              ? 'Dispatcher'
              : role === 'PATIENT'
                ? 'Patient'
                : user?.hospitalName ?? 'Hospital staff'}
          </p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scroll-slim">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <NavLink
                        to={item.to}
                        end={['/dispatcher', '/hospital', '/patient'].includes(item.to)}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                            isActive
                              ? 'bg-brand-600 text-white shadow-glow'
                              : 'text-white/65 hover:bg-white/[0.08] hover:text-white'
                          }`
                        }
                      >
                        <Icon size={16} className="shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
          <p className="mt-3 px-2.5 text-[10px] uppercase tracking-[0.12em] text-white/25">
            GoldenHour v0.14 -{' '}
            {role === 'DISPATCHER'
              ? 'dispatch console'
              : role === 'PATIENT'
                ? 'patient portal'
                : 'hospital console'}
          </p>
        </div>
      </aside>
    </>
  );
}
