import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  ArrowLeft,
  Loader2,
  MapPin,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, ErrorState, LoadingBlock } from '../components/ui/Card';
import { AmbulanceStatusChip } from '../components/ui/Badges';
import { api, describeApiError } from '../lib/api';
import type { AmbulanceStatus, NearbyAmbulance } from '../lib/types';
import { useRealtime } from '../lib/realtime';

interface FleetAmbulance {
  ambulanceId: string;
  regNo: string;
  status: AmbulanceStatus;
  location: { lat: number; lon: number; label: string };
}

export function FleetPage() {
  const [fleet, setFleet] = useState<FleetAmbulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regNo, setRegNo] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [status, setStatus] = useState<AmbulanceStatus>('AVAILABLE');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ fleet: FleetAmbulance[] }>('/ambulances');
      setFleet(response.data.fleet);
      setError(null);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(() => {
    void load();
  });

  const addAmbulance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.post<{ ambulance: NearbyAmbulance }>('/ambulances', {
        regNo: regNo.trim(),
        lat: Number(lat),
        lon: Number(lon),
        status,
      });
      setRegNo('');
      setLat('');
      setLon('');
      await load();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Ambulance fleet"
      subtitle="Register vehicles; only AVAILABLE vehicles can be dispatched"
      onRefresh={() => void load()}
    >
      <Link
        to="/dispatcher"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to command center
      </Link>

      <PageHeader
        eyebrow="Fleet management"
        title="Add and review ambulances"
        description="The fleet starts empty. Register each vehicle with its current coordinates; busy and offline vehicles are excluded from ambulance search by the database query."
        action={
          <button type="button" className="btn-secondary !px-4 !py-2" onClick={() => void load()}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Register an ambulance" icon={PlusCircle} />
          <form className="card-pad space-y-3" onSubmit={(event) => void addAmbulance(event)}>
            <div>
              <label htmlFor="regNo" className="label">
                Registration number
              </label>
              <input
                id="regNo"
                className="input"
                value={regNo}
                onChange={(event) => setRegNo(event.target.value)}
                placeholder="KA-25-AB-4821"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ambLat" className="label">
                  Latitude
                </label>
                <input
                  id="ambLat"
                  className="input"
                  inputMode="decimal"
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  placeholder="15.3647"
                />
              </div>
              <div>
                <label htmlFor="ambLon" className="label">
                  Longitude
                </label>
                <input
                  id="ambLon"
                  className="input"
                  inputMode="decimal"
                  value={lon}
                  onChange={(event) => setLon(event.target.value)}
                  placeholder="75.1240"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ambStatus" className="label">
                Status
              </label>
              <select
                id="ambStatus"
                className="input"
                value={status}
                onChange={(event) => setStatus(event.target.value as AmbulanceStatus)}
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>

            {formError ? (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {formError}
              </div>
            ) : null}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <PlusCircle size={15} /> Add ambulance
                </>
              )}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Fleet"
            subtitle="All registered vehicles"
            icon={AmbulanceIcon}
            action={
              <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                {fleet.length}
              </span>
            }
          />
          {loading ? <LoadingBlock label="Loading fleet" /> : null}
          {error && fleet.length === 0 ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : null}
          {!loading && fleet.length === 0 && !error ? (
            <p className="px-5 py-8 text-center text-[12px] text-ink-500">
              No ambulances registered yet. Add the first vehicle on the left.
            </p>
          ) : null}
          {fleet.length > 0 ? (
            <ul className="divide-y divide-ink-200/60">
              {fleet.map((vehicle) => (
                <li key={vehicle.ambulanceId} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-500">
                    <AmbulanceIcon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink-900">
                      {vehicle.regNo}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-ink-500">
                      <MapPin size={10} /> {vehicle.location.label} ·{' '}
                      {vehicle.location.lat.toFixed(4)}, {vehicle.location.lon.toFixed(4)}
                    </p>
                  </div>
                  <AmbulanceStatusChip status={vehicle.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
