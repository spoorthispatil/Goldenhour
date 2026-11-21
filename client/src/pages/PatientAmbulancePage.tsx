import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Siren,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { RequestStatusChip, SeverityBadge } from '../components/ui/Badges';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import type { BloodGroup, PatientRequest, Severity } from '../lib/types';
import { usePolledResource } from '../lib/usePolledResource';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function PatientAmbulancePage() {
  const { data, error, loading, refresh } = usePolledResource<{
    requests: PatientRequest[];
  }>('/patient/requests', 5000);

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [severity, setSeverity] = useState<Severity>('HIGH');
  const [blood, setBlood] = useState('');
  const [medicine, setMedicine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationNotice, setLocationNotice] = useState<
    { tone: 'info' | 'warning'; text: string } | null
  >(null);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationNotice({
        tone: 'warning',
        text: 'This browser does not expose your location. Enter the coordinates manually.',
      });
      return;
    }
    setLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLon(position.coords.longitude.toFixed(6));
        setAccuracy(Math.round(position.coords.accuracy));
        setLocationNotice({ tone: 'info', text: 'Coordinates taken from this device.' });
        setLocating(false);
      },
      (failure) => {
        const text =
          failure.code === failure.PERMISSION_DENIED
            ? 'Location access is blocked for this site. Allow it in your browser settings, then tap the button again - or type the coordinates.'
            : failure.code === failure.POSITION_UNAVAILABLE
              ? 'Your device could not work out a location. Enter the coordinates manually.'
              : 'Getting your location took too long. Try again, or enter the coordinates manually.';
        setAccuracy(null);
        setLocationNotice({ tone: 'warning', text });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  // Fill the coordinates from the device as soon as the page opens, so the
  // call is placed from where the patient actually is.
  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (cancelled) return;
          if (status.state === 'denied') {
            setLocationNotice({
              tone: 'warning',
              text: 'Location access is blocked for this site. Allow it in your browser settings, then tap the button again - or type the coordinates.',
            });
            return;
          }
        } catch {
          // Permissions API is unavailable in this browser; just ask for the location.
        }
      }
      if (!cancelled) useMyLocation();
    };

    void detect();
    return () => {
      cancelled = true;
    };
  }, [useMyLocation]);

  const onManualCoordinate = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setAccuracy(null);
    setLocationNotice(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setReceipt(null);

    const latValue = Number(lat);
    const lonValue = Number(lon);
    if (!Number.isFinite(latValue) || latValue < -90 || latValue > 90) {
      setFormError('Latitude must be between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lonValue) || lonValue < -180 || lonValue > 180) {
      setFormError('Longitude must be between -180 and 180.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post<{
        message: string;
        request: { requestId: string; queuePosition: number | null };
      }>('/patient/requests', {
        lat: latValue,
        lon: lonValue,
        severity,
        bloodGroupNeeded: blood || null,
        medicineNeeded: medicine.trim() || null,
      });
      setReceipt(response.data.message);
      refresh();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Call an ambulance"
      subtitle="Your call enters the same dispatcher queue as every other emergency"
      onRefresh={refresh}
    >
      <PageHeader
        eyebrow="Emergency"
        title="Send an ambulance request"
        description="Your name, age and contact come from your patient account. Dispatchers rank the call by severity, find the nearest available ambulance and match a ready hospital."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader title="Emergency details" icon={Siren} />
          <form className="card-pad space-y-4" onSubmit={(event) => void submit(event)}>
            <div>
              <label htmlFor="severity" className="label">
                How serious is it?
              </label>
              <select
                id="severity"
                className="input"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as Severity)}
              >
                <option value="CRITICAL">CRITICAL - immediately life threatening</option>
                <option value="HIGH">HIGH - urgent</option>
                <option value="MEDIUM">MEDIUM - stable but needs care</option>
                <option value="LOW">LOW - non-urgent</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="patientLat" className="label">
                  Latitude
                </label>
                <div className="relative">
                  <MapPin
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="patientLat"
                    className="input !pl-9"
                    inputMode="decimal"
                    value={lat}
                    onChange={(event) => onManualCoordinate(setLat)(event.target.value)}
                    placeholder="15.3647"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="patientLon" className="label">
                  Longitude
                </label>
                <input
                  id="patientLon"
                  className="input"
                  inputMode="decimal"
                  value={lon}
                  onChange={(event) => onManualCoordinate(setLon)(event.target.value)}
                  placeholder="75.1240"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={useMyLocation}
                className="btn-secondary !py-2 text-[12px]"
                disabled={locating}
              >
                {locating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Locating…
                  </>
                ) : (
                  <>
                    <Crosshair size={14} /> Use my current location
                  </>
                )}
              </button>
              {locating ? (
                <span className="text-[11px] text-ink-400">
                  Asking your browser for the device location…
                </span>
              ) : accuracy !== null ? (
                <span className="text-[11px] text-ink-400">
                  Device location · within {accuracy} m
                </span>
              ) : null}
            </div>

            {locationNotice ? (
              <div
                className={
                  locationNotice.tone === 'info'
                    ? 'flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-800'
                    : 'flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800'
                }
              >
                {locationNotice.tone === 'info' ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                )}
                {locationNotice.text}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="patientBlood" className="label">
                  Blood needed (optional)
                </label>
                <select
                  id="patientBlood"
                  className="input"
                  value={blood}
                  onChange={(event) => setBlood(event.target.value)}
                >
                  <option value="">Not required</option>
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="patientMedicine" className="label">
                  Medicine needed (optional)
                </label>
                <input
                  id="patientMedicine"
                  className="input"
                  value={medicine}
                  onChange={(event) => setMedicine(event.target.value)}
                  placeholder="Adrenaline"
                />
              </div>
            </div>

            {formError ? (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {formError}
              </div>
            ) : null}

            {receipt ? (
              <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12px] text-emerald-800">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> {receipt}
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Sending to dispatch…
                </>
              ) : (
                <>
                  <Siren size={15} /> Call an ambulance now
                </>
              )}
            </button>
            <p className="text-[11px] leading-relaxed text-ink-400">
              This is a simulation and is not connected to 108. In a real
              emergency, call the public emergency number.
            </p>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="My calls"
            subtitle="Status from the dispatch console"
            icon={Ambulance}
            action={
              <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                {data?.requests.length ?? 0}
              </span>
            }
          />
          {loading && !data ? <LoadingBlock label="Loading your calls" /> : null}
          {error && !data ? <ErrorState message={error} onRetry={refresh} /> : null}
          {data && data.requests.length === 0 ? (
            <EmptyState
              title="No calls yet"
              description="Your emergency requests will appear here with the assigned hospital and ambulance."
            />
          ) : null}
          {data && data.requests.length > 0 ? (
            <ul className="divide-y divide-ink-200/60">
              {data.requests.map((request) => (
                <li key={request.requestId} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-ink-900">
                      {request.requestId}
                    </p>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={request.severity} />
                      <RequestStatusChip status={request.status} />
                    </div>
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-500">
                    {new Date(request.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <div className="mt-2 grid gap-1 text-[11px] text-ink-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {request.lat.toFixed(4)},{' '}
                      {request.lon.toFixed(4)}
                    </span>
                    <span>
                      Hospital: {request.hospitalName ?? 'matching in progress'}
                    </span>
                    <span>
                      Ambulance: {request.ambulanceRegNo ?? 'not assigned yet'}
                    </span>
                    {request.bloodGroupNeeded || request.medicineNeeded ? (
                      <span>
                        Needs:{' '}
                        {[request.bloodGroupNeeded, request.medicineNeeded]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
