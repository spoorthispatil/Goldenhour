import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Droplets,
  Gauge,
  MapPin,
  Navigation,
  Pill,
  PlusCircle,
  Search,
  Timer,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { HospitalMatchTable } from '../components/dashboard/HospitalMatchTable';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from '../components/ui/Card';
import { RequestStatusChip, SeverityBadge } from '../components/ui/Badges';
import { api, describeApiError } from '../lib/api';
import type { EmergencyRequestListItem, HospitalMatchData } from '../lib/types';
import { formatWaiting } from '../lib/severity';

const NEARNESS_SAMPLES = [
  { km: 0, points: 20 },
  { km: 5, points: 16 },
  { km: 10, points: 12 },
  { km: 12.5, points: 10 },
  { km: 20, points: 4 },
  { km: 25, points: 0 },
];

export function HospitalMatchPage() {
  const [queue, setQueue] = useState<EmergencyRequestListItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState<HospitalMatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [lastMatched, setLastMatched] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.get<{ requests: EmergencyRequestListItem[] }>(
        '/emergency-requests',
        { params: { status: 'QUEUED', limit: 100 } },
      );
      setQueue(response.data.requests);
      setQueueError(null);
    } catch (err) {
      setQueueError(describeApiError(err));
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selected && queue.length > 0) setSelected(queue[0].requestId);
  }, [queue, selected]);

  const runMatch = useCallback(async (requestId: string) => {
    if (!requestId) return;
    setMatching(true);
    setError(null);
    try {
      const response = await api.get<HospitalMatchData>('/hospitals/match', {
        params: { requestId },
      });
      setData(response.data);
      setLastMatched(new Date());
    } catch (err) {
      setError(describeApiError(err));
      setData(null);
    } finally {
      setMatching(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void runMatch(selected);
  }, [selected, runMatch]);

  const selectedItem = queue.find((item) => item.requestId === selected) ?? null;

  return (
    <AppShell
      title="Hospital matching"
      subtitle="Readiness scored out of 100: blood 40, medicine 40, nearness 20"
      onRefresh={() => {
        void loadQueue();
        if (selected) void runMatch(selected);
      }}
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      <PageHeader
        eyebrow="Readiness matching"
        title="Which hospital is ready for this patient?"
        description="Only hospitals with a free bed are scored. Blood and medicine stock decide 80 of the 100 points; straight-line nearness supplies the remaining 20 on an approved 25 km linear decay."
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
              className="btn-primary !px-4 !py-2"
              onClick={() => void runMatch(selected)}
              disabled={!selected || matching}
            >
              <Search size={15} /> {matching ? 'Matching…' : 'Match hospitals'}
            </button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Emergency under match"
              subtitle="Only queued calls can be matched"
              icon={Building2}
            />
            <div className="card-pad space-y-4">
              {queueError ? (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] text-red-700">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{queueError}</span>
                </div>
              ) : null}

              {queue.length === 0 && !queueError ? (
                <EmptyState
                  title="No queued emergencies"
                  description="Register an emergency to match it against hospital readiness."
                />
              ) : (
                <>
                  <div>
                    <label htmlFor="matchSelect" className="label">
                      Emergency request
                    </label>
                    <select
                      id="matchSelect"
                      className="input"
                      value={selected}
                      onChange={(event) => setSelected(event.target.value)}
                    >
                      {queue.map((item) => (
                        <option key={item.requestId} value={item.requestId}>
                          {item.requestId} - {item.patient.name} ({item.severity},{' '}
                          {formatWaiting(item.waitingMinutes)} waiting)
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedItem ? (
                    <div className="rounded-xl border border-ink-200/70 bg-canvas/60 p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={selectedItem.severity} />
                        <RequestStatusChip status={selectedItem.status} />
                        <span className="chip border-ink-200 bg-white text-ink-600">
                          <MapPin size={11} /> {selectedItem.location.label}
                        </span>
                        <span className="chip border-ink-200 bg-white text-ink-600">
                          <Timer size={11} />{' '}
                          {formatWaiting(selectedItem.waitingMinutes)} waiting
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-600">
                        <span>
                          {selectedItem.patient.name}, {selectedItem.patient.age} yrs
                        </span>
                        <span className="chip border-red-200 bg-red-50 text-red-700">
                          <Droplets size={11} />{' '}
                          {selectedItem.bloodGroupNeeded ?? 'no blood group'}
                        </span>
                        <span className="chip border-ink-200 bg-white text-ink-600">
                          <Pill size={11} />{' '}
                          {selectedItem.medicineNeeded ?? 'no medicine'}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Ranked hospitals"
              subtitle={
                data
                  ? `${data.stats.eligible} eligible of ${
                      data.stats.eligible + data.stats.excluded
                    } hospitals - highest readiness first`
                  : 'Highest readiness score first'
              }
              icon={Trophy}
              action={
                <span className="text-[11px] text-ink-400">
                  {lastMatched
                    ? `matched ${lastMatched.toLocaleTimeString('en-IN', { hour12: true })}`
                    : 'not matched yet'}
                </span>
              }
            />
            {error ? (
              <ErrorState message={error} onRetry={() => void runMatch(selected)} />
            ) : null}
            {!error && matching && !data ? (
              <LoadingBlock label="Scoring hospital readiness" />
            ) : null}
            {!error && data ? <HospitalMatchTable hospitals={data.hospitals} /> : null}
            {!error && !data && !matching ? (
              <EmptyState
                title="Choose an emergency"
                description="Select a queued call to score every hospital with a free bed."
              />
            ) : null}
          </Card>

          {data && data.excludedHospitals.length > 0 ? (
            <Card>
              <CardHeader
                title="Excluded before scoring"
                subtitle="No free bed, so readiness is irrelevant"
                icon={BedDouble}
                action={
                  <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                    {data.excludedHospitals.length}
                  </span>
                }
              />
              <ul className="divide-y divide-ink-200/60">
                {data.excludedHospitals.map((hospital) => (
                  <li
                    key={hospital.hospitalId}
                    className="flex flex-wrap items-center gap-2 px-5 py-2.5"
                  >
                    <span className="text-[12px] font-semibold text-ink-900">
                      {hospital.name}
                    </span>
                    <span className="text-[11.5px] text-ink-500">{hospital.area}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] tabular-nums text-ink-500">
                      <Navigation size={11} /> {hospital.distanceKm.toFixed(2)} km
                    </span>
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                      0 free beds
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Readiness weights"
              subtitle="Fixed at 100 points"
              icon={Gauge}
            />
            <div className="card-pad space-y-3.5">
              {[
                { label: 'Required blood group in stock', points: 40, width: '40%' },
                { label: 'Required medicine in stock', points: 40, width: '40%' },
                { label: 'Nearness to the emergency', points: 20, width: '20%' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12px] font-medium text-ink-700">{row.label}</p>
                    <p className="text-[12px] font-bold tabular-nums text-ink-900">
                      {row.points}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: row.width }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-500">
                A requirement that does not exist is awarded in full - a hospital cannot
                fail a blood group the patient does not need. A required item scores 40 or
                0; stock is never counted proportionally.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Nearness curve"
              subtitle="Approved before implementation"
              icon={Navigation}
            />
            <div className="card-pad space-y-3">
              <code className="block rounded-lg bg-ink-900 px-3 py-2.5 font-mono text-[11px] text-emerald-200">
                nearness = 20 × max(0, 1 − d / 25)
              </code>
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-400">
                    <th className="py-1 font-semibold">Distance</th>
                    <th className="py-1 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/60">
                  {NEARNESS_SAMPLES.map((sample) => (
                    <tr key={sample.km}>
                      <td className="py-1.5 text-ink-600">
                        {sample.km} km{sample.km === 25 ? ' or more' : ''}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-ink-800">
                        {sample.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] leading-relaxed text-ink-500">
                d is the Haversine distance in kilometres, rounded to 2 decimals. The
                curve is linear to zero at 25 km, so far hospitals still compete on
                blood and medicine.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Eligibility"
              subtitle="No free bed means no score"
              icon={BedDouble}
            />
            {data ? (
              <ul className="divide-y divide-ink-200/60 text-[12px]">
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">Eligible hospitals</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-700">
                    {data.stats.eligible}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">Excluded (no free bed)</span>
                  <span className="rounded-md bg-red-50 px-2 py-0.5 font-mono font-bold text-red-700">
                    {data.stats.excluded}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">Best readiness</span>
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono font-bold text-brand-700">
                    {data.stats.bestScore ?? '-'}
                    {data.stats.bestScore !== null ? '/100' : ''}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="px-5 py-6 text-[12px] text-ink-500">
                Counts appear after the first match.
              </p>
            )}
            <p className="border-t border-ink-200/60 px-5 py-3 text-[11px] leading-relaxed text-ink-400">
              Matching ranks candidates. Reserving the bed and ambulance happens on the
              Assignment desk, where the server locks the rows and refuses a double
              booking.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
