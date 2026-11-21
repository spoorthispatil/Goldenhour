import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  HeartPulse,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Siren,
  User,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/layout/Brand';
import { api, describeApiError } from '../lib/api';
import { homeFor, useAuth } from '../lib/auth';
import type { BloodGroup } from '../lib/types';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type Mode = 'HOSPITAL' | 'DISPATCHER' | 'PATIENT';

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>(
    params.get('role') === 'dispatcher'
      ? 'DISPATCHER'
      : params.get('role') === 'patient'
        ? 'PATIENT'
        : 'HOSPITAL',
  );
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [totalBeds, setTotalBeds] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const messages: string[] = [];
    if (mode === 'PATIENT') {
      if (name.trim().length < 2) messages.push('Your name is required.');
      const ageValue = Number(age);
      if (!Number.isInteger(ageValue) || ageValue < 0 || ageValue > 120) {
        messages.push('Age must be a whole number from 0 to 120.');
      }
      if (!/^[0-9]{10}$/.test(contact.trim())) {
        messages.push('Contact number must be exactly 10 digits.');
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        messages.push('Enter a valid email address, or leave it blank.');
      }
      if (city.trim() && (city.trim().length < 2 || city.trim().length > 80)) {
        messages.push('City must be 2-80 characters, or leave it blank.');
      }
    }
    if (mode === 'HOSPITAL') {
      if (hospitalName.trim().length < 2) messages.push('Hospital name is required.');
      const latValue = Number(lat);
      const lonValue = Number(lon);
      if (!lat.trim() || !Number.isFinite(latValue) || latValue < -90 || latValue > 90) {
        messages.push('Latitude must be between -90 and 90.');
      }
      if (!lon.trim() || !Number.isFinite(lonValue) || lonValue < -180 || lonValue > 180) {
        messages.push('Longitude must be between -180 and 180.');
      }
      const beds = Number(totalBeds);
      if (!Number.isInteger(beds) || beds < 1) {
        messages.push('Total beds must be a whole number of at least 1.');
      }
    }
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username.trim())) {
      messages.push('Username must be 3-60 letters, numbers, dots, dashes or underscores.');
    }
    if (password.length < 8) messages.push('Password must be at least 8 characters.');
    if (password !== confirm) messages.push('Passwords do not match.');
    setFieldErrors(messages);
    return messages.length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === 'HOSPITAL') {
        await api.post('/auth/register/hospital', {
          hospitalName: hospitalName.trim(),
          lat: Number(lat),
          lon: Number(lon),
          totalBeds: Number(totalBeds),
          username: username.trim(),
          password,
        });
      } else if (mode === 'PATIENT') {
        await api.post('/auth/register/patient', {
          name: name.trim(),
          age: Number(age),
          contact: contact.trim(),
          email: email.trim() || null,
          city: city.trim() || null,
          bloodGroup: bloodGroup || null,
          username: username.trim(),
          password,
        });
      } else {
        await api.post('/auth/register/dispatcher', {
          username: username.trim(),
          password,
        });
      }
      const user = await login(username.trim(), password);
      navigate(
        mode === 'HOSPITAL' ? '/hospital/resources' : homeFor(user.role),
        { replace: true },
      );
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-5 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
          <Brand subtitle="Create an account" />
          <h1 className="mt-5 text-[24px] font-bold tracking-tight text-ink-900">
            {mode === 'PATIENT' ? 'Create your patient account' : 'Register your organisation'}
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
            {mode === 'PATIENT'
              ? 'Sign up with your name and contact number to call an ambulance, check hospital readiness, pre-book a bed and receive donation camp alerts.'
              : 'The system starts empty. A hospital account creates the hospital and begins with no stock; import your dataset after signing in. Dispatchers register separately and add the fleet.'}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
            {(['HOSPITAL', 'DISPATCHER', 'PATIENT'] as Mode[]).map((option) => {
              const Icon =
                option === 'HOSPITAL'
                  ? Building2
                  : option === 'DISPATCHER'
                    ? Siren
                    : HeartPulse;
              const selected = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    setError(null);
                    setFieldErrors([]);
                  }}
                  aria-pressed={selected}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold transition ${
                    selected
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  <Icon size={15} />
                  {option === 'HOSPITAL'
                    ? 'Hospital'
                    : option === 'DISPATCHER'
                      ? 'Dispatcher'
                      : 'Patient'}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            {mode === 'PATIENT' ? (
              <>
                <div>
                  <label htmlFor="patientName" className="label">
                    Full name
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <input
                      id="patientName"
                      className="input !pl-9"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="patientAge" className="label">
                      Age
                    </label>
                    <input
                      id="patientAge"
                      className="input"
                      inputMode="numeric"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="35"
                    />
                  </div>
                  <div>
                    <label htmlFor="patientContact" className="label">
                      Contact number
                    </label>
                    <div className="relative">
                      <Phone
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                      />
                      <input
                        id="patientContact"
                        className="input !pl-9"
                        inputMode="numeric"
                        value={contact}
                        onChange={(event) => setContact(event.target.value)}
                        placeholder="9845000123"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="patientEmail" className="label">
                    Email (optional)
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <input
                      id="patientEmail"
                      type="email"
                      className="input !pl-9"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="patientCity" className="label">
                      City (optional)
                    </label>
                    <input
                      id="patientCity"
                      className="input"
                      value={city}
                      maxLength={80}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Hubballi"
                    />
                  </div>
                  <div>
                    <label htmlFor="patientBloodGroup" className="label">
                      Blood group (optional)
                    </label>
                    <select
                      id="patientBloodGroup"
                      className="input"
                      value={bloodGroup}
                      onChange={(event) => setBloodGroup(event.target.value)}
                    >
                      <option value="">Not set</option>
                      {BLOOD_GROUPS.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-ink-400">
                  Optional details let hospitals send you targeted donation campaigns by email,
                  SMS and browser push. You can change them later under Notifications.
                </p>
              </>
            ) : null}

            {mode === 'HOSPITAL' ? (
              <>
                <div>
                  <label htmlFor="hospitalName" className="label">
                    Hospital name
                  </label>
                  <div className="relative">
                    <Building2
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <input
                      id="hospitalName"
                      className="input !pl-9"
                      value={hospitalName}
                      onChange={(event) => setHospitalName(event.target.value)}
                      placeholder="City General Hospital"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lat" className="label">
                      Latitude
                    </label>
                    <div className="relative">
                      <MapPin
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                      />
                      <input
                        id="lat"
                        className="input !pl-9"
                        inputMode="decimal"
                        value={lat}
                        onChange={(event) => setLat(event.target.value)}
                        placeholder="15.3647"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lon" className="label">
                      Longitude
                    </label>
                    <input
                      id="lon"
                      className="input"
                      inputMode="decimal"
                      value={lon}
                      onChange={(event) => setLon(event.target.value)}
                      placeholder="75.1240"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-ink-400">
                  Coordinates place the hospital in the distance calculation. Use the
                  hospital's actual location.
                </p>

                <div>
                  <label htmlFor="totalBeds" className="label">
                    Total licensed beds
                  </label>
                  <input
                    id="totalBeds"
                    className="input"
                    inputMode="numeric"
                    value={totalBeds}
                    onChange={(event) => setTotalBeds(event.target.value)}
                    placeholder="120"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label htmlFor="username" className="label">
                {mode === 'HOSPITAL'
                  ? 'Staff username'
                  : mode === 'PATIENT'
                    ? 'Choose a username'
                    : 'Dispatcher username'}
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="username"
                  autoComplete="username"
                  className="input !pl-9"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="hospital.admin"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    type="password"
                    autoComplete="new-password"
                    className="input !pl-9"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirm" className="label">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
            </div>

            {fieldErrors.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11.5px] text-red-700">
                {fieldErrors.map((message) => (
                  <li key={message} className="flex gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {message}
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Creating account…
                </>
              ) : (
                <>
                  Create{' '}
                  {mode === 'HOSPITAL'
                    ? 'hospital'
                    : mode === 'PATIENT'
                      ? 'patient'
                      : 'dispatcher'}{' '}
                  account
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
            {mode === 'HOSPITAL'
              ? 'You become the first staff account for this hospital. The hospital ID is generated by the server and cannot be chosen.'
              : mode === 'PATIENT'
                ? 'Your patient ID is generated by the server. Hospital staff only see you when you call an ambulance or book a bed.'
                : 'Dispatcher accounts can register emergencies, manage the fleet and close cases.'}
          </p>
        </div>
      </div>
    </div>
  );
}
