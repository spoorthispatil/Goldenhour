import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { prisma } from '../db/prisma';

/**
 * Outbound providers for campaign notifications.
 *
 * Nothing here is required for the app to boot: a channel whose provider is not
 * configured reports SKIPPED with a reason instead of pretending to send. Email
 * uses Resend and SMS uses Twilio over their REST APIs (no SDK), while push uses
 * the Web Push protocol through the `web-push` package.
 */

export type DeliveryStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export interface DeliveryResult {
  status: DeliveryStatus;
  provider: string;
  detail: string | null;
}

const TIMEOUT_MS = 8_000;

function envText(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function skipped(provider: string, detail: string): DeliveryResult {
  return { status: 'SKIPPED', provider, detail };
}

function failed(provider: string, detail: string): DeliveryResult {
  return { status: 'FAILED', provider, detail: detail.slice(0, 300) };
}

function sent(provider: string): DeliveryResult {
  return { status: 'SENT', provider, detail: null };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function emailProviderConfigured(): boolean {
  return Boolean(envText('RESEND_API_KEY') && envText('NOTIFY_EMAIL_FROM'));
}

export function smsProviderConfigured(): boolean {
  return Boolean(
    envText('TWILIO_ACCOUNT_SID') &&
      envText('TWILIO_AUTH_TOKEN') &&
      envText('TWILIO_FROM'),
  );
}

/** Keep full addresses out of the delivery report. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return phone.length <= 4 ? '***' : `***${phone.slice(-4)}`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<DeliveryResult> {
  const provider = 'resend';
  const apiKey = envText('RESEND_API_KEY');
  const from = envText('NOTIFY_EMAIL_FROM');
  if (!apiKey || !from) return skipped(provider, 'EMAIL_NOT_CONFIGURED');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return failed(provider, `Resend rejected the message (${response.status}): ${body}`);
    }
    return sent(provider);
  } catch (error) {
    return failed(provider, `Could not reach Resend: ${errorMessage(error)}`);
  }
}

export async function sendSms(input: { to: string; text: string }): Promise<DeliveryResult> {
  const provider = 'twilio';
  const accountSid = envText('TWILIO_ACCOUNT_SID');
  const authToken = envText('TWILIO_AUTH_TOKEN');
  const from = envText('TWILIO_FROM');
  if (!accountSid || !authToken || !from) return skipped(provider, 'SMS_NOT_CONFIGURED');

  const countryCode = envText('NOTIFY_SMS_COUNTRY_CODE') || '+91';
  const to = input.to.startsWith('+') ? input.to : `${countryCode}${input.to}`;

  try {
    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: input.text.slice(0, 480),
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return failed(provider, `Twilio rejected the message (${response.status}): ${text}`);
    }
    return sent(provider);
  } catch (error) {
    return failed(provider, `Could not reach Twilio: ${errorMessage(error)}`);
  }
}

export interface PushSubscriptionKeys {
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult extends DeliveryResult {
  /** Subscriptions the push service reported as gone (404/410). */
  expiredSubscriptionIds: string[];
}

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

/**
 * VAPID keys identify this server to the browser push service. Production
 * deployments should set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY so subscriptions
 * survive a restart; in development a pair is generated once per process.
 */
function ensureVapid(): { publicKey: string; privateKey: string } {
  if (vapidKeys) return vapidKeys;

  const publicKey = envText('VAPID_PUBLIC_KEY');
  const privateKey = envText('VAPID_PRIVATE_KEY');
  if (publicKey && privateKey) {
    vapidKeys = { publicKey, privateKey };
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    console.warn(
      '[notifications] VAPID keys were generated for this process only. Set ' +
        'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to keep browser subscriptions across restarts.',
    );
  }

  webpush.setVapidDetails(
    envText('VAPID_SUBJECT') || 'mailto:notifications@goldenhour.local',
    vapidKeys.publicKey,
    vapidKeys.privateKey,
  );
  return vapidKeys;
}

export function vapidPublicKey(): string {
  return ensureVapid().publicKey;
}

export function pushConfigured(): boolean {
  return Boolean(vapidPublicKey());
}

export async function sendPush(input: {
  subscriptions: PushSubscriptionKeys[];
  title: string;
  body: string;
  reference: string;
}): Promise<PushResult> {
  const provider = 'web-push';
  if (input.subscriptions.length === 0) {
    return { ...skipped(provider, 'NO_PUSH_SUBSCRIPTION'), expiredSubscriptionIds: [] };
  }

  ensureVapid();
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    tag: input.reference,
    url: '/patient/notifications',
    id: randomUUID(),
  });

  const expiredSubscriptionIds: string[] = [];
  const results = await Promise.all(
    input.subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
        return 'SENT' as const;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredSubscriptionIds.push(subscription.subscriptionId);
          return 'EXPIRED' as const;
        }
        return 'FAILED' as const;
      }
    }),
  );

  if (expiredSubscriptionIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { subscriptionId: { in: expiredSubscriptionIds } } })
      .catch(() => undefined);
  }

  if (results.includes('SENT')) {
    return { ...sent(provider), expiredSubscriptionIds };
  }
  return {
    ...failed(provider, 'The browser push service rejected every subscription.'),
    expiredSubscriptionIds,
  };
}
