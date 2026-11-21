import { useEffect, useState } from 'react';
import { Database, LogOut, Menu, RefreshCw, ServerCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatClock } from '../../lib/severity';
import { useAuth } from '../../lib/auth';
import { useHealth } from '../../lib/usePolledResource';

export function Topbar({
  title,
  subtitle,
  onMenu,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  onMenu: () => void;
  onRefresh?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const { data: health } = useHealth(20000);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const apiOnline = Boolean(health);
  const dbConnected = health?.database.connected ?? false;

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-canvas/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-lg border border-ink-200 bg-white p-2 text-ink-700 shadow-sm lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold text-ink-900">{title}</h1>
          <p className="truncate text-[12px] text-ink-500">{subtitle}</p>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-600"
            title="Express API reachable through the Vite proxy"
          >
            <ServerCog size={13} className={apiOnline ? 'text-stable' : 'text-critical'} />
            API {apiOnline ? 'online' : 'offline'}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-600"
            title={health?.database.message ?? 'PostgreSQL connectivity comes from /api/health'}
          >
            <Database size={13} className={dbConnected ? 'text-stable' : 'text-ink-400'} />
            DB {dbConnected ? 'connected' : 'not connected'}
          </span>
        </div>

        <div className="hidden items-center gap-3 pl-1 text-right sm:flex">
          <div>
            <p className="text-[13px] font-semibold tabular-nums text-ink-900">
              {formatClock(now)}
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">
              Hubballi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <span className="hidden items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-800 text-[11px] font-bold uppercase text-white">
                {user.username.slice(0, 2)}
              </span>
              <span className="text-[11.5px] font-semibold text-ink-700">
                {user.role === 'DISPATCHER'
                  ? 'Dispatcher'
                  : user.role === 'PATIENT'
                    ? 'Patient'
                    : 'Hospital staff'}
              </span>
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }));
            }}
            className="rounded-lg border border-ink-200 bg-white p-2 text-ink-500 shadow-sm transition hover:text-critical"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-ink-200 bg-white p-2 text-ink-600 shadow-sm transition hover:text-brand-600"
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
