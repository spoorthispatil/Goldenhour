import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ambulance as AmbulanceIcon,
  Gauge,
  MapPin,
  Navigation,
  PlusCircle,
  Search,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { NearbyAmbulanceTable } from '../components/dashboard/NearbyAmbulanceTable';
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
  EmergencyRequestListItem,
} from '../lib/types';
import { formatWaiting } from '../lib/severity';

export function AmbulanceSearchPage() {
  const [queue, setQueue] = useState<EmergencyRequestListItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState<AmbulanceSearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [lastSearched, setLastSearched] = useState<Date | null>(null);

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
    if (!selected && queue.length > 0) {
      setSelected(queue[0].requestId);
    }
  }, [queue, selected]);

  const runSearch = useCallback(async (requestId: string) => {
    if (!requestId) return;
    setSearching(true);
    setError(null);
    try {
      const response = await api.get<AmbulanceSearchData>('/ambulances/search', {
        params: { requestId, limit: 6 },
      });
      setData(response.data);
      setLastSearched(new Date());
    } catch (err) {
      setError(describeApiError(err));
      setData(null);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void runSearch(selected);
  }, [selected, runSearch]);

  const selectedItem = queue.find((item) => item.requestId === selected) ?? null;

  return (
    <AppShell
      title="Ambulance search"
      subtitle="Haversine distance from an emergency to the nearest available vehicles"
      onRefresh={() => {
        void loadQueue();
        if (selected) void runSearch(selected);
      }}
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      <PageHeader
        eyebrow="Fleet search"
        title="Nearest available ambulance"
        description="Pick a queued emergency. The API measures the great-circle distance to every AVAILABLE ambulance, drops BUSY and OFFLINE vehicles, and returns the nearest first with an ETA."
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
              onClick={() => void runSearch(selected)}
              disabled={!selected || searching}
            >
              <Search size={15} /> {searching ? 'Searching…' : 'Search nearest'}
            </button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Emergency under search"
              subtitle="Only queued calls can be searched"
              icon={AmbulanceIcon}
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
                  description="Every call already has an ambulance, or none have been registered yet. Register a new emergency to search for a vehicle."
                />
              ) : (
                <>
                  <div>
                    <label htmlFor="requestSelect" className="label">
                      Emergency request
                    </label>
                    <select
                      id="requestSelect"
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
                      <p className="mt-2 text-[12px] text-ink-600">
                        {selectedItem.patient.name}, {selectedItem.patient.age} yrs -{' '}
                        {selectedItem.patient.contact}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-ink-400">
                        {selectedItem.location.lat}, {selectedItem.location.lon}
                      </p>
                      {selectedItem.bloodGroupNeeded || selectedItem.medicineNeeded ? (
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {selectedItem.bloodGroupNeeded ? (
                            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                              {selectedItem.bloodGroupNeeded}
                            </span>
                          ) : null}
                          {selectedItem.medicineNeeded ? (
                            <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">
                              {selectedItem.medicineNeeded}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Nearest available ambulances"
              subtitle={
                data
                  ? `${data.search.eligible} available of ${data.search.totalFleet} in the fleet - sorted by distance`
                  : 'Sorted nearest first, with ETA'
              }
              icon={Navigation}
              action={
                <span className="text-[11px] text-ink-400">
                  {lastSearched
                    ? `searched ${lastSearched.toLocaleTimeString('en-IN', { hour12: true })}`
                    : 'not searched yet'}
                </span>
              }
            />
            {error ? (
              <ErrorState message={error} onRetry={() => void runSearch(selected)} />
            ) : null}
            {!error && searching && !data ? (
              <LoadingBlock label="Measuring distance to available ambulances" />
            ) : null}
            {!error && data ? <NearbyAmbulanceTable data={data} /> : null}
            {!error && !data && !searching ? (
              <EmptyState
                title="Choose an emergency"
                description="Select a queued call above and the nearest available vehicles appear here."
              />
            ) : null}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="How distance is measured"
              subtitle="Stored coordinates, straight-line distance"
              icon={Gauge}
            />
            <ul className="space-y-2.5 p-5 text-[12px] leading-relaxed text-ink-600">
              <li>
                <span className="font-semibold text-ink-800">Haversine formula.</span>{' '}
                The great-circle distance between the emergency and each vehicle is
                computed from their stored latitude and longitude in kilometres.
              </li>
              <li>
                <span className="font-semibold text-ink-800">
                  Straight line, not road distance.
                </span>{' '}
                No routing service is called, so distances are optimistic.
              </li>
              <li>
                <span className="font-semibold text-ink-800">ETA assumption.</span>{' '}
                {data ? data.search.speedKmh : 35} km/h average urban speed with a
                3-minute minimum, so ETA = round(distance ÷ speed × 60).
              </li>
              <li>
                <span className="font-semibold text-ink-800">Deterministic order.</span>{' '}
                Distance ascending, then registration number when two vehicles are
                equally far.
              </li>
              <li>
                <span className="font-semibold text-ink-800">No caching.</span> Every
                search re-reads PostgreSQL, so a vehicle that just became BUSY is gone
                on the next click.
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Eligibility filter"
              subtitle="Busy and offline vehicles are never returned"
              icon={AmbulanceIcon}
            />
            {data ? (
              <ul className="divide-y divide-ink-200/60 text-[12px]">
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">AVAILABLE (eligible)</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-700">
                    {data.search.eligible}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">BUSY (excluded)</span>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono font-bold text-amber-700">
                    {data.search.excluded.BUSY}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">OFFLINE (excluded)</span>
                  <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono font-bold text-ink-500">
                    {data.search.excluded.OFFLINE}
                  </span>
                </li>
                <li className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-ink-700">Total fleet</span>
                  <span className="font-mono font-bold text-ink-800">
                    {data.search.totalFleet}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="px-5 py-6 text-[12px] text-ink-500">
                Counts appear after the first search.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
