import type { ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../../lib/auth';
import type { UserRole } from '../../lib/auth';

function SessionCheck() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-ink-500">
        <Loader2 className="animate-spin text-brand-600" size={22} />
        <p className="text-[13px]">Checking your session…</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionCheck />;

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (user.role !== role) {
    // Signed in, but this area belongs to another role.
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <>{children}</>;
}

export function ForbiddenPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-5">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-critical">
          <ShieldAlert size={22} />
        </span>
        <h1 className="mt-4 text-[20px] font-bold text-ink-900">Access denied</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">
          This area belongs to a different role. Patients, hospital staff and
          dispatchers have separate consoles.
        </p>
        <Link to="/" className="btn-primary mt-5">
          Back to GoldenHour
        </Link>
      </div>
    </div>
  );
}
