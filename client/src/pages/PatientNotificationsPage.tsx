import { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  Building2,
  CalendarDays,
  CheckCheck,
  Droplets,
  HeartPulse,
  Mail,
  MapPin,
  MessageSquare,
  Save,
  Settings2,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';
import { disablePush, enablePush, pushSupported } from '../lib/push';
import type {
  BloodGroup,
  CampaignType,
  DonationCampaign,
  PatientDeliveryProfile,
} from '../lib/types';
import { usePolledResource } from '../lib/usePolledResource';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type Filter = 'ALL' | CampaignType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All alerts' },
  { key: 'BLOOD_DONATION', label: 'Blood donation' },
  { key: 'ORGAN_DONATION', label: 'Organ donation' },
];

export function PatientNotificationsPage() {
  const { data, error, loading, refresh } = usePolledResource<{
    campaigns: DonationCampaign[];
    unread: number;
  }>('/patient/campaigns', 10000);
  const {
    data: delivery,
    loading: profileLoading,
    refresh: refreshProfile,
  } = usePolledResource<PatientDeliveryProfile>('/patient/profile', 30000);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!delivery || hydrated) return;
    setEmail(delivery.profile.email ?? '');
    setCity(delivery.profile.city ?? '');
    setBloodGroup(delivery.profile.bloodGroup ?? '');
    setNotifyEmail(delivery.profile.notifyEmail);
    setNotifySms(delivery.profile.notifySms);
    setNotifyPush(delivery.profile.notifyPush);
    setHydrated(true);
  }, [delivery, hydrated]);

  const saveSettings = async () => {
    setSaving(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await api.patch('/patient/profile', {
        email: email.trim(),
        city: city.trim(),
        bloodGroup: bloodGroup || null,
        notifyEmail,
        notifySms,
        notifyPush,
      });
      setSettingsMessage('Delivery settings saved.');
      refreshProfile();
    } catch (err) {
      setSettingsError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const subscribePush = async () => {
    setPushBusy(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const subscription = await enablePush();
      await api.post('/patient/push/subscriptions', subscription);
      setSettingsMessage('This browser will now receive push notifications.');
      refreshProfile();
    } catch (err) {
      setSettingsError(describeApiError(err));
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribePush = async () => {
    setPushBusy(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await disablePush();
      setSettingsMessage('Push notifications are turned off for this browser.');
      refreshProfile();
    } catch (err) {
      setSettingsError(describeApiError(err));
    } finally {
      setPushBusy(false);
    }
  };

  const campaigns =
    data?.campaigns.filter((campaign) => filter === 'ALL' || campaign.type === filter) ?? [];
  const unread = data?.campaigns.filter((campaign) => !campaign.read).length ?? 0;

  const markRead = async (campaign: DonationCampaign) => {
    if (campaign.read) return;
    setBusy(campaign.campaignId);
    setActionError(null);
    try {
      await api.post(`/patient/campaigns/${campaign.campaignId}/read`);
      refresh();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const markAll = async () => {
    setBusy('all');
    setActionError(null);
    try {
      await api.post('/patient/campaigns/read-all');
      refresh();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell
      title="Notifications"
      subtitle="Blood donation and organ donation camps from hospitals"
      onRefresh={refresh}
    >
      <PageHeader
        eyebrow="Donation alerts"
        title="Camps you can join"
        description="Every campaign is published by a registered hospital. Unread alerts stay highlighted until you open them."
        action={
          <button
            type="button"
            className="btn-secondary !px-4 !py-2"
            onClick={() => void markAll()}
            disabled={busy === 'all' || unread === 0}
          >
            <CheckCheck size={15} />
            {busy === 'all' ? 'Marking…' : `Mark all read${unread ? ` (${unread})` : ''}`}
          </button>
        }
      />

      <Card className="mb-5">
        <CardHeader
          title="Delivery settings"
          subtitle="Campaigns reach you here; add contact details for email, SMS and browser push"
          icon={Settings2}
        />
        <div className="card-pad space-y-3">
          {profileLoading && !delivery ? <LoadingBlock label="Loading delivery settings" /> : null}
          {delivery ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="notifyEmailAddress" className="label">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <input
                      id="notifyEmailAddress"
                      type="email"
                      className="input !pl-9"
                      value={email}
                      maxLength={160}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="notifyCity" className="label">
                    City
                  </label>
                  <input
                    id="notifyCity"
                    className="input"
                    value={city}
                    maxLength={80}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Hubballi"
                  />
                </div>
                <div>
                  <label htmlFor="notifyBloodGroup" className="label">
                    Blood group
                  </label>
                  <select
                    id="notifyBloodGroup"
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
                  <p className="mt-1 text-[10.5px] text-ink-400">
                    City and blood group let hospitals target campaigns at you.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="label">Channels</span>
                  {[
                    { key: 'email', label: 'Email', icon: Mail, value: notifyEmail, set: setNotifyEmail },
                    { key: 'sms', label: 'SMS', icon: MessageSquare, value: notifySms, set: setNotifySms },
                    { key: 'push', label: 'Push', icon: Bell, value: notifyPush, set: setNotifyPush },
                  ].map(({ key, label, icon: Icon, value, set }) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-700"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={13} /> {label}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={value}
                        onChange={(event) => set(event.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-3.5 py-2.5 text-[11.5px] text-ink-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Bell size={12} className="mr-1 inline" />
                    {delivery.pushDevices.length > 0
                      ? `${delivery.pushDevices.length} browser(s) subscribed to push`
                      : 'No browser subscribed to push on this account'}
                  </span>
                  {pushSupported() ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 !text-[11px]"
                        onClick={() => void subscribePush()}
                        disabled={pushBusy}
                      >
                        {pushBusy ? 'Working…' : 'Enable push'}
                      </button>
                      {delivery.pushDevices.length > 0 ? (
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 !text-[11px]"
                          onClick={() => void unsubscribePush()}
                          disabled={pushBusy}
                        >
                          Turn off
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-ink-400">
                      This browser does not support push notifications.
                    </span>
                  )}
                </div>
              </div>

              {settingsError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-[11.5px] text-red-700">
                  {settingsError}
                </p>
              ) : null}
              {settingsMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[11.5px] text-emerald-800">
                  {settingsMessage}
                </p>
              ) : null}

              <button
                type="button"
                className="btn-primary !px-4 !py-2"
                onClick={() => void saveSettings()}
                disabled={saving}
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save delivery settings'}
              </button>
            </>
          ) : null}
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
              filter === option.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {actionError}
        </div>
      ) : null}

      {loading && !data ? (
        <Card>
          <LoadingBlock label="Loading donation alerts" />
        </Card>
      ) : null}
      {error && !data ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : null}

      {data && campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaigns in this filter"
            description="Hospitals publish blood and organ donation camps from their console; they appear here immediately."
          />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((campaign) => {
          const isBlood = campaign.type === 'BLOOD_DONATION';
          const Icon = isBlood ? Droplets : HeartPulse;
          return (
            <Card
              key={campaign.campaignId}
              className={`overflow-hidden ${!campaign.read ? 'ring-2 ring-brand-200' : ''}`}
            >
              <div className="flex items-start gap-3 p-5">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    isBlood ? 'bg-red-50 text-critical' : 'bg-brand-50 text-brand-600'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-600">
                      {isBlood ? 'Blood donation' : 'Organ donation'}
                    </span>
                    {!campaign.read ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        <BellRing size={9} /> New
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 text-[14px] font-bold text-ink-900">{campaign.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">
                    {campaign.description}
                  </p>

                  <dl className="mt-3 space-y-1 text-[11.5px] text-ink-500">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={12} />
                      {new Date(campaign.startsAt).toLocaleString('en-IN', {
                        dateStyle: 'full',
                        timeStyle: 'short',
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} /> {campaign.location}
                    </div>
                    {campaign.hospitalName ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} /> {campaign.hospitalName}
                      </div>
                    ) : null}
                  </dl>

                  <button
                    type="button"
                    onClick={() => void markRead(campaign)}
                    disabled={campaign.read || busy === campaign.campaignId}
                    className="mt-3 text-[11.5px] font-semibold text-brand-600 transition hover:text-brand-700 disabled:text-ink-400"
                  >
                    {campaign.read
                      ? 'Read'
                      : busy === campaign.campaignId
                        ? 'Marking…'
                        : 'Mark as read'}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
