import { useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Droplets,
  ListOrdered,
  Loader2,
  MapPin,
  Pill,
  PlusCircle,
  ShieldCheck,
  Siren,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import {
  RequestStatusChip,
  SeverityBadge,
} from '../components/ui/Badges';
import { Card, CardHeader } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import { SEVERITY_ORDER, SEVERITY_STYLE, SEVERITY_WEIGHT } from '../lib/severity';
import type { CreatedEmergency, FieldError, Severity } from '../lib/types';

const AREA_PRESETS = [
  { label: 'Gokul Road', lat: 15.3739, lon: 75.1039 },
  { label: 'Vidyanagar', lat: 15.3647, lon: 75.124 },
  { label: 'Navanagar', lat: 15.361, lon: 75.085 },
  { label: 'Old Hubballi', lat: 15.3539, lon: 75.129 },
  { label: 'Keshwapur', lat: 15.37, lon: 75.133 },
  { label: 'Sattur', lat: 15.3345, lon: 75.118 },
  { label: 'Unkal', lat: 15.377, lon: 75.118 },
];

interface FormState {
  patientName: string;
  patientAge: string;
  contact: string;
  lat: string;
  lon: string;
  severity: Severity;
  bloodGroupNeeded: string;
  medicineNeeded: string;
}

const INITIAL_FORM: FormState = {
  patientName: '',
  patientAge: '',
  contact: '',
  lat: '15.3739',
  lon: '75.1039',
  severity: 'CRITICAL',
  bloodGroupNeeded: '',
  medicineNeeded: '',
};

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = form.patientName.trim();
  if (!name) errors.patientName = 'Patient name is required.';
  else if (name.length < 2) errors.patientName = 'Name must be at least 2 characters.';

  if (form.patientAge.trim() === '') {
    errors.patientAge = 'Age is required.';
  } else {
    const age = Number(form.patientAge);
    if (!Number.isInteger(age)) errors.patientAge = 'Age must be a whole number.';
    else if (age < 0 || age > 120) errors.patientAge = 'Age must be between 0 and 120.';
  }

  const contact = form.contact.trim();
  if (!contact) errors.contact = 'Contact number is required.';
  else if (!/^[0-9]{10}$/.test(contact)) {
    errors.contact = 'Contact number must be exactly 10 digits.';
  }

  const lat = Number(form.lat);
  if (form.lat.trim() === '') errors.lat = 'Latitude is required.';
  else if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.lat = 'Latitude must be between -90 and 90.';
  }

  const lon = Number(form.lon);
  if (form.lon.trim() === '') errors.lon = 'Longitude is required.';
  else if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.lon = 'Longitude must be between -180 and 180.';
  }

  const medicine = form.medicineNeeded.trim();
  if (medicine && medicine.length < 3) {
    errors.medicineNeeded = 'Medicine name must be at least 3 characters.';
  }

  return errors;
}

function FieldMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error">
      <AlertCircle size={13} /> {message}
    </p>
  );
}

export function RegisterEmergencyPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedEmergency | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: '' }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const response = await api.post<{ request: CreatedEmergency }>(
        '/emergency-requests',
        {
          patientName: form.patientName.trim(),
          patientAge: Number(form.patientAge),
          contact: form.contact.trim(),
          lat: Number(form.lat),
          lon: Number(form.lon),
          severity: form.severity,
          bloodGroupNeeded: form.bloodGroupNeeded || null,
          medicineNeeded: form.medicineNeeded.trim() || null,
        },
      );
      setCreated(response.data.request);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (isAxiosError<{ message?: string; errors?: FieldError[] }>(error)) {
        const payload = error.response?.data;
        if (payload?.errors?.length) {
          setErrors(
            Object.fromEntries(payload.errors.map((item) => [item.field, item.message])),
          );
        }
        setServerError(payload?.message ?? describeApiError(error));
      } else {
        setServerError(describeApiError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Register emergency"
      subtitle="Capture the call, validate it and push it into the ranked queue"
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      <PageHeader
        eyebrow="Emergency intake"
        title="New emergency request"
        description="Every field is validated on the server before the patient and request rows are written in one transaction."
      />

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          {created ? (
            <Card className="overflow-hidden">
              <div className="h-1.5 w-full bg-stable" />
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-stable">
                    <CheckCircle2 size={22} />
                  </span>
                  <div>
                    <h2 className="text-[18px] font-semibold text-ink-900">
                      Emergency queued
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-500">
                      The patient and the request were stored together in PostgreSQL.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-ink-200/70 bg-canvas/60 p-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    Request ID
                  </p>
                  <p className="mt-1 font-mono text-[22px] font-bold tracking-tight text-ink-900">
                    {created.requestId}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={created.severity} />
                    <RequestStatusChip status={created.status} />
                    <span className="chip border-ink-200 bg-white text-ink-600">
                      <MapPin size={11} /> {created.location.label}
                    </span>
                    {typeof created.queuePosition === 'number' ? (
                      <span className="chip border-brand-200 bg-brand-50 text-brand-700">
                        <ListOrdered size={11} /> Rank {created.queuePosition} in queue
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 text-[12.5px]">
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      Patient
                    </dt>
                    <dd className="mt-1 font-semibold text-ink-900">
                      {created.patient.name}
                    </dd>
                    <dd className="text-[11.5px] text-ink-500">
                      {created.patient.age} yrs - {created.patient.contact}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      Requirements
                    </dt>
                    <dd className="mt-1 font-semibold text-ink-900">
                      {created.bloodGroupNeeded ?? 'No blood group'}
                    </dd>
                    <dd className="text-[11.5px] text-ink-500">
                      {created.medicineNeeded ?? 'No medicine'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      Patient row
                    </dt>
                    <dd className="mt-1 font-mono text-[11.5px] text-ink-700">
                      {created.patient.patientId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                      Created at
                    </dt>
                    <dd className="mt-1 text-[11.5px] text-ink-700">
                      {new Date(created.createdAt).toLocaleString('en-IN')}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link to="/dispatcher" className="btn-primary">
                    Back to command center <ArrowRight size={15} />
                  </Link>
                  <Link to="/dispatcher/queue" className="btn-secondary">
                    <ListOrdered size={15} /> Open priority queue
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setCreated(null);
                      setForm(INITIAL_FORM);
                      setErrors({});
                    }}
                  >
                    <PlusCircle size={15} /> Register another
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Patient and emergency details"
                subtitle="Fields marked with an asterisk are required"
                icon={Siren}
              />
              <form className="card-pad space-y-6" onSubmit={onSubmit} noValidate>
                {serverError ? (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700"
                  >
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                ) : null}

                <section>
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    <User size={14} className="text-brand-600" /> Patient
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="patientName" className="label">
                        Full name *
                      </label>
                      <input
                        id="patientName"
                        className={`input ${errors.patientName ? 'input-invalid' : ''}`}
                        placeholder="e.g. Usha Nayak"
                        value={form.patientName}
                        onChange={(event) => update('patientName', event.target.value)}
                        aria-invalid={Boolean(errors.patientName)}
                      />
                      <FieldMessage message={errors.patientName} />
                    </div>
                    <div>
                      <label htmlFor="patientAge" className="label">
                        Age *
                      </label>
                      <input
                        id="patientAge"
                        className={`input ${errors.patientAge ? 'input-invalid' : ''}`}
                        placeholder="0 - 120"
                        inputMode="numeric"
                        value={form.patientAge}
                        onChange={(event) => update('patientAge', event.target.value)}
                        aria-invalid={Boolean(errors.patientAge)}
                      />
                      <FieldMessage message={errors.patientAge} />
                    </div>
                    <div>
                      <label htmlFor="contact" className="label">
                        Contact number *
                      </label>
                      <input
                        id="contact"
                        className={`input ${errors.contact ? 'input-invalid' : ''}`}
                        placeholder="10 digits"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.contact}
                        onChange={(event) =>
                          update('contact', event.target.value.replace(/\D/g, ''))
                        }
                        aria-invalid={Boolean(errors.contact)}
                      />
                      <FieldMessage message={errors.contact} />
                    </div>
                  </div>
                </section>

                <section className="border-t border-ink-200/70 pt-5">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    <MapPin size={14} className="text-brand-600" /> Emergency location
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label htmlFor="areaPreset" className="label">
                        Pick a Hubballi area (optional shortcut)
                      </label>
                      <select
                        id="areaPreset"
                        className="input"
                        defaultValue=""
                        onChange={(event) => {
                          const preset = AREA_PRESETS.find(
                            (item) => item.label === event.target.value,
                          );
                          if (preset) {
                            setForm((previous) => ({
                              ...previous,
                              lat: String(preset.lat),
                              lon: String(preset.lon),
                            }));
                            setErrors((previous) => ({ ...previous, lat: '', lon: '' }));
                          }
                        }}
                      >
                        <option value="">Choose an area…</option>
                        {AREA_PRESETS.map((preset) => (
                          <option key={preset.label} value={preset.label}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="lat" className="label">
                        Latitude *
                      </label>
                      <input
                        id="lat"
                        className={`input ${errors.lat ? 'input-invalid' : ''}`}
                        value={form.lat}
                        onChange={(event) => update('lat', event.target.value)}
                        aria-invalid={Boolean(errors.lat)}
                      />
                      <FieldMessage message={errors.lat} />
                    </div>
                    <div>
                      <label htmlFor="lon" className="label">
                        Longitude *
                      </label>
                      <input
                        id="lon"
                        className={`input ${errors.lon ? 'input-invalid' : ''}`}
                        value={form.lon}
                        onChange={(event) => update('lon', event.target.value)}
                        aria-invalid={Boolean(errors.lon)}
                      />
                      <FieldMessage message={errors.lon} />
                    </div>
                  </div>
                </section>

                <section className="border-t border-ink-200/70 pt-5">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    <ShieldCheck size={14} className="text-brand-600" /> Severity *
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SEVERITY_ORDER.map((severity) => {
                      const style = SEVERITY_STYLE[severity];
                      const selected = form.severity === severity;
                      return (
                        <button
                          key={severity}
                          type="button"
                          onClick={() => update('severity', severity)}
                          aria-pressed={selected}
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                            selected
                              ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10'
                              : 'border-ink-200 hover:border-ink-300'
                          }`}
                        >
                          <span className={`h-8 w-1.5 rounded-full ${style.dot}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold text-ink-900">
                              {style.label}
                              <span className="ml-1.5 text-[10.5px] font-medium text-ink-400">
                                weight {SEVERITY_WEIGHT[severity]}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-500">
                              {style.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="border-t border-ink-200/70 pt-5">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    <Droplets size={14} className="text-red-500" /> Hospital requirements
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="bloodGroup" className="label">
                        Blood group needed
                      </label>
                      <select
                        id="bloodGroup"
                        className={`input ${errors.bloodGroupNeeded ? 'input-invalid' : ''}`}
                        value={form.bloodGroupNeeded}
                        onChange={(event) =>
                          update('bloodGroupNeeded', event.target.value)
                        }
                        aria-invalid={Boolean(errors.bloodGroupNeeded)}
                      >
                        <option value="">Not required</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
                          (group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ),
                        )}
                      </select>
                      <FieldMessage message={errors.bloodGroupNeeded} />
                    </div>
                    <div>
                      <label htmlFor="medicine" className="label">
                        Medicine needed
                      </label>
                      <div className="relative">
                        <Pill
                          size={15}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                        />
                        <input
                          id="medicine"
                          className={`input !pl-9 ${errors.medicineNeeded ? 'input-invalid' : ''}`}
                          placeholder="e.g. Adrenaline"
                          value={form.medicineNeeded}
                          onChange={(event) =>
                            update('medicineNeeded', event.target.value)
                          }
                          aria-invalid={Boolean(errors.medicineNeeded)}
                        />
                      </div>
                      <FieldMessage message={errors.medicineNeeded} />
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap items-center gap-3 border-t border-ink-200/70 pt-5">
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Queueing…
                      </>
                    ) : (
                      <>
                        <Siren size={15} /> Queue emergency
                      </>
                    )}
                  </button>
                  <p className="text-[11.5px] text-ink-400">
                    Status is set to QUEUED; the server ranks the call immediately and
                    dispatch happens on the assignment desk.
                  </p>
                </div>
              </form>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="What happens on submit" icon={ShieldCheck} />
            <ol className="space-y-3 p-5 text-[12px] text-ink-600">
              {[
                'The server re-validates every field - the browser check is only a convenience.',
                'A PostgreSQL advisory lock reserves the next request ID (REQ-YYYY-NNNN).',
                'The patient row and emergency_request row are inserted in one transaction.',
                'If either insert fails, both roll back and nothing is queued.',
                'The request appears in the dispatcher queue with status QUEUED.',
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[10.5px] font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Severity weights" subtitle="Used by the priority queue" icon={Siren} />
            <ul className="divide-y divide-ink-200/60">
              {SEVERITY_ORDER.map((severity) => (
                <li
                  key={severity}
                  className="flex items-center gap-3 px-5 py-2.5 text-[12px]"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${SEVERITY_STYLE[severity].dot}`}
                  />
                  <span className="flex-1 font-medium text-ink-800">
                    {SEVERITY_STYLE[severity].label}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-ink-500">
                    {SEVERITY_WEIGHT[severity]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
