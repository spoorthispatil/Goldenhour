import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Droplets,
  Loader2,
  MapPin,
  Pill,
  X,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import type { PatientHospital, PatientPrebooking } from '../lib/types';
import { usePolledResource } from '../lib/usePolledResource';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-ink-100 text-ink-500',
  CANCEL_REQUESTED: 'bg-amber-50 text-amber-700',
  ADMITTED: 'bg-brand-50 text-brand-700',
  DISCHARGED: 'bg-ink-100 text-ink-500',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting hospital',
  CONFIRMED: 'Bed reserved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  CANCEL_REQUESTED: 'Cancellation requested',
  ADMITTED: 'Admitted',
  DISCHARGED: 'Discharged',
};

/** One-hour slots the hospital network accepts pre-bookings for. */
const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const LEAD_MINUTES = 15;

function slotInstant(dateInput: string, hour: number): Date {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultSlotDate(): string {
  const now = new Date();
  const cutOff = now.getTime() + LEAD_MINUTES * 60_000;
  const hasSlotToday = SLOT_HOURS.some(
    (hour) => slotInstant(toDateInput(now), hour).getTime() > cutOff,
  );
  if (hasSlotToday) return toDateInput(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInput(tomorrow);
}

function formatSlot(start: string | null, end: string | null): string {
  if (!start) return 'No slot requested';
  const startDate = new Date(start);
  const startText = startDate.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  if (!end) return startText;
  const endText = new Date(end).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${startText} – ${endText}`;
}

export function PatientHospitalsPage() {
  const hospitals = usePolledResource<{ hospitals: PatientHospital[] }>(
    '/patient/hospitals',
    10000,
  );
  const prebookings = usePolledResource<{ prebookings: PatientPrebooking[] }>(
    '/patient/prebookings',
    10000,
  );

  const [selected, setSelected] = useState<PatientHospital | null>(null);
  const [reason, setReason] = useState('');
  const [slotDate, setSlotDate] = useState(defaultSlotDate);
  const [slotHour, setSlotHour] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const openForm = (hospital: PatientHospital) => {
    setSelected(hospital);
    setReason('');
    setSlotDate(defaultSlotDate());
    setSlotHour(SLOT_HOURS[1]);
    setMessage(null);
    setFormError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const start = slotInstant(slotDate, slotHour);
    if (start.getTime() < Date.now() + LEAD_MINUTES * 60_000) {
      setFormError('That slot has already passed. Choose a later time.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setMessage(null);
    try {
      const response = await api.post<{ message: string }>('/patient/prebookings', {
        hospitalId: selected.hospitalId,
        reason: reason.trim(),
        slotStart: start.toISOString(),
      });
      setMessage(response.data.message);
      setSelected(null);
      setReason('');
      hospitals.refresh();
      prebookings.refresh();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (prebookingId: string) => {
    setCancelling(prebookingId);
    setMessage(null);
    setFormError(null);
    try {
      const response = await api.patch<{ message: string }>(
        `/patient/prebookings/${prebookingId}/cancel`,
        { reason: cancelReason.trim() || null },
      );
      setMessage(response.data.message);
      setCancelTarget(null);
      setCancelReason('');
      hospitals.refresh();
      prebookings.refresh();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <AppShell
      title="Hospitals & pre-booking"
      subtitle="Compare live bed and stock levels, then reserve a slot before you travel"
      onRefresh={() => {
        hospitals.refresh();
        prebookings.refresh();
      }}
    >
      <PageHeader
        eyebrow="Hospital network"
        title="Find a ready hospital"
        description="Free beds, blood units and medicines are the same values dispatchers match against. Pick a one-hour slot; the hospital confirms it, reserves a bed and admits you when you arrive."
      />

      {message ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-800">
          <CheckCircle2 size={14} /> {message}
        </div>
      ) : null}
      {formError ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          <AlertTriangle size={14} /> {formError}
        </div>
      ) : null}

      {hospitals.loading && !hospitals.data ? (
        <Card>
          <LoadingBlock label="Loading hospitals" />
        </Card>
      ) : null}
      {hospitals.error && !hospitals.data ? (
        <Card>
          <ErrorState message={hospitals.error} onRetry={hospitals.refresh} />
        </Card>
      ) : null}

      {hospitals.data ? (
        hospitals.data.hospitals.length === 0 ? (
          <Card>
            <EmptyState
              title="No hospitals registered"
              description="Hospitals appear here after they register and import their beds and stock."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hospitals.data.hospitals.map((hospital) => (
              <Card key={hospital.hospitalId} className="flex flex-col">
                <div className="card-pad flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-bold text-ink-900">{hospital.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                        <MapPin size={10} /> {hospital.lat.toFixed(4)},{' '}
                        {hospital.lon.toFixed(4)}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                        hospital.accepting
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {hospital.accepting ? 'Accepting' : 'Full'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <p className="text-[30px] font-bold leading-none text-ink-900">
                      {hospital.freeBeds}
                    </p>
                    <p className="pb-0.5 text-[11.5px] text-ink-500">
                      free of {hospital.totalBeds}
                    </p>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                    <BedDouble size={11} /> beds available
                  </p>

                  <div className="mt-4">
                    <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                      <Droplets size={11} /> Blood
                    </p>
                    {hospital.bloodStock.length === 0 ? (
                      <p className="mt-1 text-[11px] text-ink-400">No blood stock listed.</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {hospital.bloodStock.map((stock) => (
                          <span
                            key={stock.group}
                            className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                              stock.units > 0
                                ? 'bg-red-50 text-red-700'
                                : 'bg-ink-100 text-ink-400'
                            }`}
                          >
                            {stock.group} {stock.units}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="mt-3 flex items-center gap-1 text-[11px] text-ink-500">
                    <Pill size={11} /> {hospital.medicineStock.length} medicines tracked
                  </p>

                  {selected?.hospitalId === hospital.hospitalId ? (
                    <form
                      className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-3"
                      onSubmit={(event) => void submit(event)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-ink-900">
                          Pre-book at {hospital.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="rounded-md p-1 text-ink-400 hover:text-ink-700"
                          aria-label="Close pre-booking form"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`slot-date-${hospital.hospitalId}`}
                            className="label"
                          >
                            Date
                          </label>
                          <input
                            id={`slot-date-${hospital.hospitalId}`}
                            type="date"
                            className="input !py-2 text-[12px]"
                            value={slotDate}
                            min={toDateInput(new Date())}
                            max={toDateInput(
                              new Date(Date.now() + 30 * 86_400_000),
                            )}
                            onChange={(event) => setSlotDate(event.target.value)}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`slot-hour-${hospital.hospitalId}`}
                            className="label"
                          >
                            Slot
                          </label>
                          <select
                            id={`slot-hour-${hospital.hospitalId}`}
                            className="input !py-2 text-[12px]"
                            value={slotHour}
                            onChange={(event) => setSlotHour(Number(event.target.value))}
                          >
                            {SLOT_HOURS.map((hour) => (
                              <option key={hour} value={hour}>
                                {String(hour).padStart(2, '0')}:00 – {String(hour + 1).padStart(2, '0')}:00
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label
                        htmlFor={`reason-${hospital.hospitalId}`}
                        className="label mt-2"
                      >
                        Reason (optional)
                      </label>
                      <textarea
                        id={`reason-${hospital.hospitalId}`}
                        className="input min-h-[64px]"
                        value={reason}
                        maxLength={300}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Planned procedure, observation, maternity…"
                      />
                      <button
                        type="submit"
                        className="btn-primary mt-2 w-full !py-2 text-[12px]"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Sending…
                          </>
                        ) : (
                          <>
                            <CalendarCheck size={14} /> Request this slot
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary mt-4 w-full !py-2 text-[12px]"
                      onClick={() => openForm(hospital)}
                      disabled={!hospital.accepting}
                    >
                      <CalendarCheck size={14} />{' '}
                      {hospital.accepting ? 'Pre-book a slot' : 'No beds to reserve'}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      <Card className="mt-5">
        <CardHeader
          title="My pre-bookings"
          subtitle="Slots you requested, beds reserved and any cancellation requests"
          icon={CalendarCheck}
          action={
            <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
              {prebookings.data?.prebookings.length ?? 0}
            </span>
          }
        />
        {prebookings.loading && !prebookings.data ? (
          <LoadingBlock label="Loading pre-bookings" />
        ) : null}
        {prebookings.data && prebookings.data.prebookings.length === 0 ? (
          <EmptyState
            title="Nothing booked yet"
            description="Choose an accepting hospital above, pick a slot and request a bed."
          />
        ) : null}
        {prebookings.data && prebookings.data.prebookings.length > 0 ? (
          <ul className="divide-y divide-ink-200/60">
            {prebookings.data.prebookings.map((prebooking) => {
              const cancellable =
                prebooking.status === 'PENDING' || prebooking.status === 'CONFIRMED';
              return (
                <li key={prebooking.prebookingId} className="px-5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-900">
                        <Building2 size={13} className="text-ink-400" />
                        {prebooking.hospital.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-600">
                        <Clock size={11} className="text-ink-400" />
                        {formatSlot(prebooking.slotStart, prebooking.slotEnd)}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-500">
                        Requested{' '}
                        {new Date(prebooking.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {prebooking.reason ? ` · ${prebooking.reason}` : ''}
                      </p>
                      {prebooking.admittedAt ? (
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          Admitted{' '}
                          {new Date(prebooking.admittedAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      ) : null}
                      {prebooking.dischargedAt ? (
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          Discharged{' '}
                          {new Date(prebooking.dischargedAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      ) : null}
                      {prebooking.status === 'CANCEL_REQUESTED' ? (
                        <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                          Cancellation requested
                          {prebooking.cancellationReason
                            ? `: “${prebooking.cancellationReason}”`
                            : '.'}{' '}
                          Waiting for the hospital to approve it.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                          STATUS_STYLE[prebooking.status]
                        }`}
                        title={STATUS_LABEL[prebooking.status]}
                      >
                        {STATUS_LABEL[prebooking.status] ?? prebooking.status}
                      </span>
                      {cancellable && cancelTarget !== prebooking.prebookingId ? (
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1 text-[11.5px] text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setCancelTarget(prebooking.prebookingId);
                            setCancelReason('');
                          }}
                        >
                          {prebooking.status === 'PENDING'
                            ? 'Cancel request'
                            : 'Request cancellation'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {cancelTarget === prebooking.prebookingId ? (
                    <div className="mt-3 rounded-xl border border-ink-200/70 bg-ink-100/40 p-3">
                      <p className="text-[11.5px] text-ink-600">
                        {prebooking.status === 'PENDING'
                          ? 'This request has not reserved a bed yet, so it is cancelled immediately.'
                          : 'Your bed stays reserved until the hospital approves the cancellation.'}
                      </p>
                      <label
                        htmlFor={`cancel-reason-${prebooking.prebookingId}`}
                        className="label mt-2"
                      >
                        Reason (optional)
                      </label>
                      <textarea
                        id={`cancel-reason-${prebooking.prebookingId}`}
                        className="input min-h-[56px]"
                        maxLength={300}
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Feeling better, plans changed, treated elsewhere…"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-1.5 text-[11.5px]"
                          disabled={cancelling === prebooking.prebookingId}
                          onClick={() => void cancel(prebooking.prebookingId)}
                        >
                          {cancelling === prebooking.prebookingId ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : null}
                          {prebooking.status === 'PENDING'
                            ? 'Cancel pre-booking'
                            : 'Send cancellation request'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 text-[11.5px]"
                          onClick={() => {
                            setCancelTarget(null);
                            setCancelReason('');
                          }}
                        >
                          Keep booking
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </AppShell>
  );
}
