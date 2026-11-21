import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Siren,
  User,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { describeApiError } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import { SEVERITY_STYLE } from '../lib/severity';
import type { Severity } from '../lib/types';

type Role = 'DISPATCHER' | 'HOSPITAL' | 'PATIENT';

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const next = params.get('next');

  const [role, setRole] = useState<Role>(
    params.get('role') === 'hospital'
      ? 'HOSPITAL'
      : params.get('role') === 'patient'
        ? 'PATIENT'
        : 'DISPATCHER',
  );
  const roleLabel =
    role === 'DISPATCHER' ? 'dispatcher' : role === 'HOSPITAL' ? 'hospital staff' : 'patient';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const destination = homeFor(user.role);
    navigate(next && next.startsWith(destination) ? next : destination, {
      replace: true,
    });
  }, [user, next, navigate]);

  const validate = () => {
    const nextErrors: { username?: string; password?: string } = {};
    if (!username.trim()) nextErrors.username = 'Username is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const signedIn = await login(username.trim(), password);
      const destination = homeFor(signedIn.role);
      navigate(next && next.startsWith(destination) ? next : destination, {
        replace: true,
      });
    } catch (error) {
      setServerError(describeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-lines opacity-50" aria-hidden="true" />
        <div
          className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-brand-600/25 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative">
          <Brand inverted />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
            <ShieldCheck size={12} /> Role-based access
          </span>
          <h2 className="mt-5 text-[30px] font-bold leading-tight text-white">
            One platform.
            <br />
            Three connected portals.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">
            Patients call an ambulance or pre-book a bed, dispatchers decide who is
            served first, and hospitals keep their readiness current so the next
            patient is not sent somewhere that cannot treat them.
          </p>

          <div className="mt-7 space-y-3">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((severity) => (
              <div key={severity} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: SEVERITY_STYLE[severity].hex }}
                />
                <span className="w-20 text-[12px] font-semibold uppercase tracking-wide text-white/80">
                  {severity}
                </span>
                <span className="text-[12px] text-white/45">
                  {SEVERITY_STYLE[severity].description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-center gap-1.5 text-[11px] text-white/35">
          <Lock size={11} /> Sessions last 8 hours in an HTTP-only cookie.
        </p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <span className="lg:hidden">
            <Brand subtitle="Emergency Response" />
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]">
            <h1 className="text-[26px] font-bold tracking-tight text-ink-900">
              Sign in to GoldenHour
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-500">
              Your role is decided by the account you sign in with.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
              {(['DISPATCHER', 'HOSPITAL', 'PATIENT'] as Role[]).map((option) => {
                const Icon =
                  option === 'DISPATCHER'
                    ? Siren
                    : option === 'HOSPITAL'
                      ? Building2
                      : HeartPulse;
                const selected = role === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setRole(option);
                      setErrors({});
                      setServerError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold transition ${
                      selected
                        ? 'bg-white text-ink-900 shadow-sm'
                        : 'text-ink-500 hover:text-ink-700'
                    }`}
                    aria-pressed={selected}
                  >
                    <Icon size={15} />
                    {option === 'DISPATCHER'
                      ? 'Dispatcher'
                      : option === 'HOSPITAL'
                        ? 'Hospital staff'
                        : 'Patient'}
                  </button>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="label">
                  Username
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    className={`input !pl-9 ${errors.username ? 'input-invalid' : ''}`}
                    placeholder="your.username"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      if (errors.username)
                        setErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    aria-invalid={Boolean(errors.username)}
                  />
                </div>
                {errors.username ? (
                  <p className="field-error">
                    <AlertCircle size={13} /> {errors.username}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`input !pl-9 !pr-10 ${errors.password ? 'input-invalid' : ''}`}
                    placeholder="Your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password)
                        setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition hover:text-ink-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="field-error">
                    <AlertCircle size={13} /> {errors.password}
                  </p>
                ) : null}
              </div>

              {serverError ? (
                <div
                  role="alert"
                  className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] leading-relaxed text-red-700"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              ) : null}

              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in as {roleLabel}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-ink-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">
                New to GoldenHour?
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
                The system starts empty. Hospitals register their organisation and import
                their own dataset; dispatchers register an account and add the fleet.
              </p>
              <Link
                to={`/register?role=${role === 'HOSPITAL' ? 'hospital' : role === 'PATIENT' ? 'patient' : 'dispatcher'}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-700"
              >
                Create an account <ArrowRight size={13} />
              </Link>
            </div>

            <p className="mt-4 text-[12px] text-ink-500">
              {role === 'DISPATCHER'
                ? 'Dispatchers rank emergencies, match ambulances and hospitals, and close cases.'
                : role === 'HOSPITAL'
                  ? 'Hospital staff see their own incoming patients, keep bed and stock levels current, and manage pre-bookings and camps.'
                  : 'Patients can call an ambulance, check hospital readiness, pre-book a bed and follow donation camps.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
