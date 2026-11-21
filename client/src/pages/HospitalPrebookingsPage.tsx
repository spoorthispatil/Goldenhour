import { useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  Undo2,
  XCircle,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import type { PatientPrebooking } from '../lib/types';
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
  PENDING: 'Awaiting decision',
  CONFIRMED: 'Bed reserved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  CANCEL_REQUESTED: 'Cancellation requested',
  ADMITTED: 'Admitted',
  DISCHARGED: 'Discharged',
};

type PrebookingAction =
  | 'CONFIRM'
  | 'DECLINE'
  | 'ADMIT'
  | 'DISCHARGE'
  | 'APPROVE_CANCELLATION'
  | 'REJECT_CANCELLATION';

function formatSlot(start: string | null, end: string | null): string {
  if (!start) return 'No slot requested';
  const startText = new Date(start).toLocaleString('en-IN', {
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

function formatMoment(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function HospitalPrebookingsPage() {
  const { data, error, loading, refresh } = usePolledResource<{
    prebookings: PatientPrebooking[];
  }>('/hospital/prebookings', 7000);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (prebookingId: string, action: PrebookingAction) => {
    setBusy(prebookingId);
    setActionError(null);
    setMessage(null);
    try {
      const response = await api.patch<{ message: string }>(
        `/hospital/prebookings/${prebookingId}`,
        { action },
      );
      setMessage(response.data.message);
      refresh();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const pending = data?.prebookings.filter((row) => row.status === 'PENDING') ?? [];
  const cancelRequests =
    data?.prebookings.filter((row) => row.status === 'CANCEL_REQUESTED') ?? [];
  const admitted = data?.prebookings.filter((row) => row.status === 'ADMITTED') ?? [];

  return (
    <AppShell
      title="Patient pre-bookings"
      subtitle="Confirm slots, admit patients and discharge them when they leave"
      onRefresh={refresh}
    >
      <PageHeader
        eyebrow="Patient services"
        title="Bed pre-bookings & admissions"
        description="Confirming a slot reserves one bed. Admitting marks the patient as occupying it; discharging releases the bed. When a patient asks to cancel a reserved bed, approve it here to return the bed to your pool."
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-600">
              <Clock size={13} className="text-amber-600" /> {pending.length} pending
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-600">
              <BedDouble size={13} className="text-brand-600" /> {admitted.length} admitted
            </span>
            {cancelRequests.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11.5px] font-semibold text-amber-700">
                <Undo2 size={13} /> {cancelRequests.length} cancellation
                {cancelRequests.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        }
      />

      {message ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-800">
          <CheckCircle2 size={14} /> {message}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          <AlertTriangle size={14} /> {actionError}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Requests"
          subtitle="Scoped to your hospital by session, nearest slot first"
          icon={CalendarCheck}
          action={
            <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
              {data?.prebookings.length ?? 0}
            </span>
          }
        />
        {loading && !data ? <LoadingBlock label="Loading pre-bookings" /> : null}
        {error && !data ? <ErrorState message={error} onRetry={refresh} /> : null}
        {data && data.prebookings.length === 0 ? (
          <EmptyState
            title="No pre-booking requests"
            description="Patients can request a slot from their portal as soon as your hospital has free beds."
          />
        ) : null}
        {data && data.prebookings.length > 0 ? (
          <ul className="divide-y divide-ink-200/60">
            {data.prebookings.map((prebooking) => (
              <li key={prebooking.prebookingId} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                      {prebooking.patient?.name ?? 'Patient'}
                      <span className="text-[11px] font-normal text-ink-400">
                        {prebooking.patient
                          ? `${prebooking.patient.age} yrs · ${prebooking.patient.patientId}`
                          : ''}
                      </span>
                    </p>
                    {prebooking.patient ? (
                      <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-500">
                        <Phone size={11} /> {prebooking.patient.contact}
                      </p>
                    ) : null}
                    <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-ink-700">
                      <Clock size={11} className="text-ink-400" />
                      {formatSlot(prebooking.slotStart, prebooking.slotEnd)}
                    </p>
                    {prebooking.reason ? (
                      <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-ink-600">
                        “{prebooking.reason}”
                      </p>
                    ) : null}
                    {prebooking.cancellationReason ? (
                      <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
                        Cancellation reason: “{prebooking.cancellationReason}”
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      Requested {formatMoment(prebooking.createdAt)}
                      {' · '}
                      {prebooking.hospital.freeBeds} free of{' '}
                      {prebooking.hospital.totalBeds} beds now
                    </p>
                    {prebooking.admittedAt ? (
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        Admitted {formatMoment(prebooking.admittedAt)}
                        {prebooking.dischargedAt
                          ? ` · discharged ${formatMoment(prebooking.dischargedAt)}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                        STATUS_STYLE[prebooking.status]
                      }`}
                    >
                      {STATUS_LABEL[prebooking.status] ?? prebooking.status}
                    </span>

                    {prebooking.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-1.5 text-[11.5px]"
                          disabled={busy === prebooking.prebookingId}
                          onClick={() => void act(prebooking.prebookingId, 'CONFIRM')}
                        >
                          {busy === prebooking.prebookingId ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 text-[11.5px]"
                          disabled={busy === prebooking.prebookingId}
                          onClick={() => void act(prebooking.prebookingId, 'DECLINE')}
                        >
                          <XCircle size={13} /> Decline
                        </button>
                      </>
                    ) : null}

                    {prebooking.status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1.5 text-[11.5px]"
                        disabled={busy === prebooking.prebookingId}
                        onClick={() => void act(prebooking.prebookingId, 'ADMIT')}
                      >
                        {busy === prebooking.prebookingId ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <BedDouble size={13} />
                        )}
                        Admit patient
                      </button>
                    ) : null}

                    {prebooking.status === 'ADMITTED' ? (
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1.5 text-[11.5px]"
                        disabled={busy === prebooking.prebookingId}
                        onClick={() => void act(prebooking.prebookingId, 'DISCHARGE')}
                      >
                        {busy === prebooking.prebookingId ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Undo2 size={13} />
                        )}
                        Discharge
                      </button>
                    ) : null}

                    {prebooking.status === 'CANCEL_REQUESTED' ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-1.5 text-[11.5px]"
                          disabled={busy === prebooking.prebookingId}
                          onClick={() =>
                            void act(prebooking.prebookingId, 'APPROVE_CANCELLATION')
                          }
                        >
                          {busy === prebooking.prebookingId ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          Approve cancellation
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 text-[11.5px]"
                          disabled={busy === prebooking.prebookingId}
                          onClick={() =>
                            void act(prebooking.prebookingId, 'REJECT_CANCELLATION')
                          }
                        >
                          <XCircle size={13} /> Keep booking
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </AppShell>
  );
}
