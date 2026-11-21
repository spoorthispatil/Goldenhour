import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  Navigation,
  PlusCircle,
  RefreshCw,
  Timer,
  X,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from '../components/ui/Card';
import { RequestStatusChip, SeverityBadge } from '../components/ui/Badges';
import { api, describeApiError } from '../lib/api';
import type {
  AmbulanceSearchData,
  AssignmentListItem,
  AssignmentResult,
  ClosureResult,
  EmergencyRequestListItem,
  HospitalMatchData,
} from '../lib/types';
import { formatWaiting } from '../lib/severity';
import { useRealtime, useRealtimeStatus } from '../lib/realtime';

export function AssignmentDeskPage() {
  const [queue, setQueue] = useState<EmergencyRequestListItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [ambulanceData, setAmbulanceData] = useState<AmbulanceSearchData | null>(null);
  const [hospitalData, setHospitalData] = useState<HospitalMatchData | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<AssignmentResult | null>(null);
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState('');
  const [closingId, setClosingId] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closureNotice, setClosureNotice] = useState<string | null>(null);
  const socketOnline = useRealtimeStatus();

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.get<{ requests: EmergencyRequestListItem[] }>(
        '/emergency-requests',
        { params: { status: 'QUEUED', limit: 100 } },
      );
      setQueue(response.data.requests);
    } catch (err) {
      setOptionsError(describeApiError(err));
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    try {
      const response = await api.get<{ assignments: AssignmentListItem[] }>(
        '/assignments',
        { params: { limit: 12 } },
      );
      setAssignments(response.data.assignments);
      setListError(null);
    } catch (err) {
      setListError(describeApiError(err));
    }
  }, []);

  const loadOptions = useCallback(async (requestId: string) => {
    if (!requestId) {
      setAmbulanceData(null);
      setHospitalData(null);
      return;
    }
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const [ambulances, hospitals] = await Promise.all([
        api.get<AmbulanceSearchData>('/ambulances/search', {
          params: { requestId, limit: 10 },
        }),
        api.get<HospitalMatchData>('/hospitals/match', { params: { requestId } }),
      ]);
      setAmbulanceData(ambulances.data);
      setHospitalData(hospitals.data);
      setSelectedAmbulanceId(ambulances.data.ambulances[0]?.ambulanceId ?? '');
      setSelectedHospitalId(hospitals.data.hospitals[0]?.hospitalId ?? '');
    } catch (err) {
      setOptionsError(describeApiError(err));
      setAmbulanceData(null);
      setHospitalData(null);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadAssignments();
  }, [loadQueue, loadAssignments]);

  useEffect(() => {
    if (queue.length === 0) {
      setSelectedRequestId('');
      return;
    }
    if (!queue.some((item) => item.requestId === selectedRequestId)) {
      setSelectedRequestId(queue[0].requestId);
    }
  }, [queue, selectedRequestId]);

  useEffect(() => {
    if (selectedRequestId) void loadOptions(selectedRequestId);
  }, [selectedRequestId, loadOptions]);

  // Another dispatcher (or a closure) changes the desk without a reload.
  useRealtime(() => {
    void loadQueue();
    void loadAssignments();
    if (selectedRequestId) void loadOptions(selectedRequestId);
  });

  const selectedRequest =
    queue.find((item) => item.requestId === selectedRequestId) ?? null;
  const selectedAmbulance =
    ambulanceData?.ambulances.find(
      (item) => item.ambulanceId === selectedAmbulanceId,
    ) ?? null;
  const selectedHospital =
    hospitalData?.hospitals.find(
      (item) => item.hospitalId === selectedHospitalId,
    ) ?? null;

  const refreshAll = () => {
    void loadQueue();
    void loadAssignments();
    if (selectedRequestId) void loadOptions(selectedRequestId);
  };

  const confirmAssignment = async () => {
    if (!selectedRequestId || !selectedAmbulanceId || !selectedHospitalId) return;
    setSubmitting(true);
    setAssignError(null);
    try {
      const response = await api.post<{ assignment: AssignmentResult }>(
        '/assignments',
        {
          requestId: selectedRequestId,
          ambulanceId: selectedAmbulanceId,
          hospitalId: selectedHospitalId,
        },
      );
      setReceipt(response.data.assignment);
      await Promise.all([loadQueue(), loadAssignments()]);
    } catch (err) {
      setAssignError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const closeCase = async (assignmentId: string) => {
    setClosingId(assignmentId);
    setCloseError(null);
    try {
      const response = await api.post<{
        status: 'closed';
        message: string;
        assignment: ClosureResult;
      }>(`/assignments/${assignmentId}/close`);
      setClosureNotice(response.data.message);
      setPendingCloseId('');
      await Promise.all([loadQueue(), loadAssignments()]);
      if (selectedRequestId) void loadOptions(selectedRequestId);
    } catch (err) {
      setCloseError(describeApiError(err));
    } finally {
      setClosingId('');
    }
  };

  const canConfirm = Boolean(
    selectedRequest && selectedAmbulance && selectedHospital && !submitting,
  );

  return (
    <AppShell
      title="Assignment desk"
      subtitle="Reserve the ambulance and one hospital bed in a single transaction"
      onRefresh={refreshAll}
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      <PageHeader
        eyebrow="Dispatch decision"
        title="Assign an ambulance and a hospital"
        description="The server re-reads the ambulance status, the hospital's free beds and its stock inside a locked transaction. A vehicle or bed taken by another dispatcher is rejected, never overwritten."
        action={
          <div className="flex flex-wrap items-end justify-end gap-3">
            <Link
              to="/dispatcher/emergency/new"
              className="btn-secondary !px-4 !py-2"
            >
              <PlusCircle size={15} /> Register emergency
            </Link>
            <button
              type="button"
              className="btn-secondary !px-4 !py-2"
              onClick={refreshAll}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        }
      />

      {receipt ? (
        <Card className="mb-5 overflow-hidden">
          <div className="h-1.5 w-full bg-stable" />
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-stable">
                <CheckCircle2 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-ink-900">
                  {receipt.requestId} assigned
                </h3>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  Ambulance {receipt.ambulance.regNo} and one bed at{' '}
                  {receipt.hospital.name} are now reserved.
                </p>
              </div>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                {receipt.hospital.remainingFreeBeds} beds left
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-ink-200/70 bg-canvas/60 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Readiness stored
                </p>
                <p className="mt-1 text-[20px] font-bold text-ink-900">
                  {receipt.readinessScore}/100
                </p>
                {receipt.partialFlag ? (
                  <span className="mt-1 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    partial
                  </span>
                ) : null}
              </div>
              <div className="rounded-xl border border-ink-200/70 bg-canvas/60 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Ambulance leg
                </p>
                <p className="mt-1 text-[12.5px] font-semibold text-ink-900">
                  {receipt.ambulance.distanceKm.toFixed(2)} km ·{' '}
                  {receipt.ambulance.etaMinutes} min
                </p>
              </div>
              <div className="rounded-xl border border-ink-200/70 bg-canvas/60 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Assignment ID
                </p>
                <p className="mt-1 truncate font-mono text-[10.5px] text-ink-600">
                  {receipt.assignmentId}
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-emerald-200">
              {receipt.reason}
            </p>
          </div>
        </Card>
      ) : null}

      {assignError ? (
        <div className="mb-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{assignError}</span>
        </div>
      ) : null}

      {closureNotice ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{closureNotice}</span>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900"
            onClick={() => setClosureNotice(null)}
            aria-label="Dismiss closure notice"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {closeError ? (
        <div className="mb-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{closeError}</span>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="1. Emergency"
            subtitle="Only queued calls can be assigned"
            icon={ClipboardCheck}
          />
          <div className="card-pad space-y-3">
            {queue.length === 0 ? (
              <EmptyState
                title="Queue is empty"
                description="Every emergency already has an assignment. Register a new call to dispatch it."
              />
            ) : (
              <>
                <select
                  className="input"
                  aria-label="Emergency request"
                  value={selectedRequestId}
                  onChange={(event) => setSelectedRequestId(event.target.value)}
                >
                  {queue.map((item) => (
                    <option key={item.requestId} value={item.requestId}>
                      {item.requestId} - {item.patient.name} ({item.severity})
                    </option>
                  ))}
                </select>
                {selectedRequest ? (
                  <div className="rounded-xl border border-ink-200/70 bg-canvas/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={selectedRequest.severity} />
                      <RequestStatusChip status={selectedRequest.status} />
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-ink-900">
                      {selectedRequest.patient.name},{' '}
                      {selectedRequest.patient.age} yrs
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-500">
                      <MapPin size={11} /> {selectedRequest.location.label} ·{' '}
                      {formatWaiting(selectedRequest.waitingMinutes)} waiting
                    </p>
                    <p className="mt-1 text-[11px] text-ink-500">
                      Blood: {selectedRequest.bloodGroupNeeded ?? 'not required'} ·
                      Medicine: {selectedRequest.medicineNeeded ?? 'not required'}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="2. Ambulance"
            subtitle="AVAILABLE only, nearest first"
            icon={AmbulanceIcon}
            action={
              ambulanceData ? (
                <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                  {ambulanceData.search.eligible} free
                </span>
              ) : null
            }
          />
          {optionsLoading && !ambulanceData ? (
            <LoadingBlock label="Finding available ambulances" />
          ) : null}
          {optionsError ? (
            <ErrorState
              message={optionsError}
              onRetry={() => void loadOptions(selectedRequestId)}
            />
          ) : null}
          {!optionsError && ambulanceData ? (
            ambulanceData.ambulances.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-ink-500">
                No AVAILABLE ambulance right now.
              </p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-ink-200/60 overflow-y-auto scroll-slim">
                {ambulanceData.ambulances.map((ambulance) => {
                  const active = ambulance.ambulanceId === selectedAmbulanceId;
                  return (
                    <li key={ambulance.ambulanceId}>
                      <button
                        type="button"
                        onClick={() => setSelectedAmbulanceId(ambulance.ambulanceId)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition ${
                          active ? 'bg-brand-50' : 'hover:bg-ink-100/40'
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                            active
                              ? 'bg-brand-600 text-white'
                              : 'bg-emerald-50 text-stable'
                          }`}
                        >
                          <AmbulanceIcon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-ink-900">
                            {ambulance.regNo}
                          </span>
                          <span className="block truncate text-[10.5px] text-ink-500">
                            {ambulance.location.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[11.5px] font-semibold tabular-nums text-ink-800">
                            {ambulance.distanceKm.toFixed(2)} km
                          </span>
                          <span className="block text-[10.5px] tabular-nums text-ink-400">
                            {ambulance.etaMinutes} min
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="3. Hospital"
            subtitle="Readiness out of 100"
            icon={Building2}
            action={
              hospitalData ? (
                <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                  {hospitalData.stats.eligible} eligible
                </span>
              ) : null
            }
          />
          {optionsLoading && !hospitalData ? (
            <LoadingBlock label="Scoring hospital readiness" />
          ) : null}
          {!optionsError && hospitalData ? (
            hospitalData.hospitals.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-ink-500">
                No hospital with a free bed.
              </p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-ink-200/60 overflow-y-auto scroll-slim">
                {hospitalData.hospitals.map((hospital) => {
                  const active = hospital.hospitalId === selectedHospitalId;
                  return (
                    <li key={hospital.hospitalId}>
                      <button
                        type="button"
                        onClick={() => setSelectedHospitalId(hospital.hospitalId)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition ${
                          active ? 'bg-brand-50' : 'hover:bg-ink-100/40'
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                            active
                              ? 'bg-brand-600 text-white'
                              : 'bg-ink-100 text-ink-500'
                          }`}
                        >
                          <Building2 size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-ink-900">
                            {hospital.name}
                          </span>
                          <span className="flex items-center gap-1 text-[10.5px] text-ink-500">
                            <Navigation size={9} /> {hospital.distanceKm.toFixed(2)} km
                            · {hospital.freeBeds} beds
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[12px] font-bold tabular-nums text-ink-900">
                            {hospital.score}
                          </span>
                          {hospital.partialFlag ? (
                            <span className="text-[9.5px] font-bold uppercase text-amber-700">
                              partial
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Confirm assignment"
          subtitle="One transaction: assignment row, ambulance BUSY, bed decremented"
          icon={CheckCircle2}
        />
        <div className="card-pad space-y-3">
          {selectedAmbulance && selectedHospital && selectedRequest ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-ink-200/70 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Ambulance
                </p>
                <p className="mt-1 text-[13px] font-semibold text-ink-900">
                  {selectedAmbulance.regNo}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-ink-500">
                  <Timer size={10} /> {selectedAmbulance.distanceKm.toFixed(2)} km ·{' '}
                  {selectedAmbulance.etaMinutes} min
                </p>
              </div>
              <div className="rounded-xl border border-ink-200/70 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Hospital
                </p>
                <p className="mt-1 text-[13px] font-semibold text-ink-900">
                  {selectedHospital.name}
                </p>
                <p className="text-[11px] text-ink-500">
                  {selectedHospital.score}/100 readiness ·{' '}
                  {selectedHospital.freeBeds} free beds
                </p>
              </div>
              <div className="rounded-xl border border-ink-200/70 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Patient
                </p>
                <p className="mt-1 text-[13px] font-semibold text-ink-900">
                  {selectedRequest.patient.name}
                </p>
                <p className="text-[11px] text-ink-500">
                  {selectedRequest.requestId} · {selectedRequest.severity}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-ink-500">
              Select an emergency, an ambulance and a hospital to continue.
            </p>
          )}

          {selectedHospital?.partialFlag ? (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Partial readiness: {selectedHospital.reason}. The assignment will be
                stored with a partial flag.
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void confirmAssignment()}
              disabled={!canConfirm}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Reserving…
                </>
              ) : (
                <>
                  <ClipboardCheck size={15} /> Confirm assignment
                </>
              )}
            </button>
            <p className="text-[11.5px] text-ink-400">
              The ambulance becomes BUSY, the request becomes ASSIGNED and one bed is
              held until the case is closed.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Assignments"
          subtitle="Open cases first; closing one releases the ambulance and bed"
          icon={ClipboardCheck}
          action={
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold ${
                  socketOnline
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-ink-100 text-ink-500'
                }`}
                title="Socket.IO pushes a change signal; the desk refetches through the API"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    socketOnline ? 'bg-emerald-600' : 'bg-ink-400'
                  }`}
                />
                {socketOnline ? 'live' : 'polling'}
              </span>
              <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                {assignments.length}
              </span>
            </div>
          }
        />
        {listError ? <ErrorState message={listError} onRetry={loadAssignments} /> : null}
        {!listError && assignments.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-ink-500">No assignments yet.</p>
        ) : null}
        {assignments.length > 0 ? (
          <ul className="divide-y divide-ink-200/60">
            {assignments.map((item) => (
              <li key={item.assignmentId} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={item.severity} />
                  <span className="text-[12.5px] font-semibold text-ink-900">
                    {item.requestId}
                  </span>
                  <span className="text-[11.5px] text-ink-500">
                    {item.patientName}
                  </span>
                  <span className="ml-auto rounded-md bg-ink-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-600">
                    {item.readinessScore}/100
                  </span>
                  {item.partialFlag ? (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      partial
                    </span>
                  ) : null}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      item.closedAt
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {item.closedAt ? 'closed' : 'open'}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-ink-500">
                  {item.ambulanceRegNo} ({item.distanceKm.toFixed(2)} km) →{' '}
                  {item.hospitalName}
                </p>

                {item.closedAt ? (
                  <p className="mt-1 text-[10.5px] text-ink-400">
                    Closed{' '}
                    {new Date(item.closedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}{' '}
                    - bed released
                  </p>
                ) : pendingCloseId === item.assignmentId ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-ink-600">
                      Release the ambulance and bed for {item.requestId}?
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-critical px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      onClick={() => void closeCase(item.assignmentId)}
                      disabled={closingId === item.assignmentId}
                    >
                      <CheckCircle2 size={12} />
                      {closingId === item.assignmentId ? 'Closing…' : 'Confirm close'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-ink-100/60"
                      onClick={() => setPendingCloseId('')}
                      disabled={closingId === item.assignmentId}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    onClick={() => {
                      setPendingCloseId(item.assignmentId);
                      setCloseError(null);
                    }}
                  >
                    <CheckCircle2 size={12} /> Close case
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </AppShell>
  );
}
