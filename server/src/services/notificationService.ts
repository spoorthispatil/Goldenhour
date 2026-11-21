import {
  CampaignAudience,
  NotificationChannel,
  NotificationStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { PortalError } from './prebookingService';
import {
  maskEmail,
  maskPhone,
  sendEmail,
  sendPush,
  sendSms,
  type DeliveryResult,
} from '../notifications/providers';

/**
 * Campaign delivery. The in-app feed is always written by creating the campaign
 * itself; this module fans it out to the channels the hospital selected and
 * records one Notification row per patient and channel so the hospital can see
 * exactly who was reached, skipped and why.
 */

export const RECIPIENT_LIMIT = 500;

export interface ChannelSummary {
  sent: number;
  skipped: number;
  failed: number;
}

export interface DeliverySummary {
  recipients: number;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  channels: Record<NotificationChannel, ChannelSummary>;
  skippedReasons: Record<string, number>;
  truncated: boolean;
}

const CHANNELS: NotificationChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
];

function emptyChannels(): Record<NotificationChannel, ChannelSummary> {
  return {
    EMAIL: { sent: 0, skipped: 0, failed: 0 },
    SMS: { sent: 0, skipped: 0, failed: 0 },
    PUSH: { sent: 0, skipped: 0, failed: 0 },
  };
}

function emptySummary(): DeliverySummary {
  return {
    recipients: 0,
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    channels: emptyChannels(),
    skippedReasons: {},
    truncated: false,
  };
}

function campaignAudienceWhere(campaign: {
  audience: CampaignAudience;
  audienceValue: string | null;
}): Prisma.PatientWhereInput {
  if (campaign.audience === CampaignAudience.CITY) {
    if (!campaign.audienceValue) return { patientId: { in: [] } };
    return { city: { equals: campaign.audienceValue, mode: 'insensitive' } };
  }
  if (campaign.audience === CampaignAudience.BLOOD_GROUP) {
    if (!campaign.audienceValue) return { patientId: { in: [] } };
    return { bloodGroup: campaign.audienceValue };
  }
  return {};
}

export function campaignMessage(campaign: {
  type: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  hospital: { name: string } | null;
}) {
  const kind = campaign.type === 'BLOOD_DONATION' ? 'Blood donation' : 'Organ donation';
  const when = campaign.startsAt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const hospital = campaign.hospital?.name ?? 'GoldenHour hospital';
  return {
    subject: `${kind}: ${campaign.title}`,
    text: [
      campaign.description,
      '',
      `When: ${when}`,
      `Where: ${campaign.location}`,
      `Organised by: ${hospital}`,
      '',
      'Open GoldenHour and go to Notifications to see the camp and mark it read.',
    ].join('\n'),
    pushBody: `${when} · ${campaign.location}`,
  };
}

function record(
  summary: DeliverySummary,
  channel: NotificationChannel,
  result: DeliveryResult,
  skippedReasons: Record<string, number>,
): void {
  summary.attempted += 1;
  summary.channels[channel][result.status.toLowerCase() as 'sent' | 'skipped' | 'failed'] += 1;
  if (result.status === 'SENT') summary.sent += 1;
  if (result.status === 'FAILED') summary.failed += 1;
  if (result.status === 'SKIPPED') {
    summary.skipped += 1;
    const reason = result.detail ?? 'SKIPPED';
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
  }
}

function optedOut(provider: string): DeliveryResult {
  return { status: 'SKIPPED', provider, detail: 'PATIENT_OPTED_OUT' };
}

function missingContact(provider: string, detail: string): DeliveryResult {
  return { status: 'SKIPPED', provider, detail };
}

/** Publishes the campaign's outbound channels and returns a delivery summary. */
export async function dispatchCampaign(campaignId: string): Promise<DeliverySummary> {
  const campaign = await prisma.campaign.findUnique({
    where: { campaignId },
    include: { hospital: { select: { name: true } } },
  });
  if (!campaign) {
    throw new PortalError('CAMPAIGN_NOT_FOUND', 404, 'That campaign does not exist.');
  }

  const summary = emptySummary();
  if (campaign.channels.length === 0) return summary;

  const patients = await prisma.patient.findMany({
    where: campaignAudienceWhere(campaign),
    orderBy: { patientId: 'asc' },
    take: RECIPIENT_LIMIT + 1,
    select: {
      patientId: true,
      email: true,
      contact: true,
      notifyEmail: true,
      notifySms: true,
      notifyPush: true,
      pushSubscriptions: { select: { subscriptionId: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const recipients = patients.slice(0, RECIPIENT_LIMIT);
  summary.truncated = patients.length > RECIPIENT_LIMIT;
  summary.recipients = recipients.length;

  const message = campaignMessage(campaign);
  const rows: Prisma.NotificationCreateManyInput[] = [];

  await Promise.all(
    recipients.map(async (patient) => {
      for (const channel of CHANNELS) {
        if (!campaign.channels.includes(channel)) continue;

        let result: DeliveryResult;
        let destination: string | null = null;

        if (channel === NotificationChannel.EMAIL) {
          if (!patient.notifyEmail) {
            result = optedOut('resend');
          } else if (!patient.email) {
            result = missingContact('resend', 'MISSING_EMAIL');
          } else {
            destination = maskEmail(patient.email);
            result = await sendEmail({
              to: patient.email,
              subject: message.subject,
              text: message.text,
            });
          }
        } else if (channel === NotificationChannel.SMS) {
          if (!patient.notifySms) {
            result = optedOut('twilio');
          } else {
            destination = maskPhone(patient.contact);
            result = await sendSms({
              to: patient.contact,
              text: `${message.subject}. ${message.pushBody}. ${message.text.split('\n').pop() ?? ''}`,
            });
          }
        } else {
          if (!patient.notifyPush) {
            result = optedOut('web-push');
          } else if (patient.pushSubscriptions.length === 0) {
            result = missingContact('web-push', 'NO_PUSH_SUBSCRIPTION');
          } else {
            destination = `${patient.pushSubscriptions.length} browser(s)`;
            result = await sendPush({
              subscriptions: patient.pushSubscriptions,
              title: message.subject,
              body: message.pushBody,
              reference: campaign.campaignId,
            });
          }
        }

        record(summary, channel, result, summary.skippedReasons);
        rows.push({
          campaignId: campaign.campaignId,
          patientId: patient.patientId,
          channel,
          status: result.status as NotificationStatus,
          destination,
          provider: result.provider,
          detail: result.detail,
          sentAt: result.status === 'SENT' ? new Date() : null,
        });
      }
    }),
  );

  if (rows.length > 0) {
    await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  }

  return summary;
}

export async function savePushSubscription(
  patientId: string,
  input: { endpoint: string; p256dh: string; auth: string },
) {
  // A browser endpoint is unique; re-subscribing (or signing in to the same
  // browser as another patient) moves it to the current patient.
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { patientId, ...input },
    update: { patientId, p256dh: input.p256dh, auth: input.auth },
    select: { subscriptionId: true, endpoint: true, createdAt: true },
  });
  return {
    subscriptionId: saved.subscriptionId,
    endpointHost: new URL(saved.endpoint).host,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function removePushSubscription(patientId: string, endpoint: string) {
  const result = await prisma.pushSubscription.deleteMany({
    where: { patientId, endpoint },
  });
  return { removed: result.count };
}

export async function campaignDeliveryReport(hospitalId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { campaignId },
    select: {
      campaignId: true,
      hospitalId: true,
      audience: true,
      audienceValue: true,
      channels: true,
    },
  });
  if (!campaign || campaign.hospitalId !== hospitalId) {
    throw new PortalError('CAMPAIGN_NOT_FOUND', 404, 'That campaign does not exist.');
  }

  const [rows, grouped] = await Promise.all([
    prisma.notification.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: 'asc' }, { patientId: 'asc' }],
      take: 200,
      select: {
        notificationId: true,
        patientId: true,
        channel: true,
        status: true,
        destination: true,
        provider: true,
        detail: true,
        sentAt: true,
        patient: { select: { name: true } },
      },
    }),
    prisma.notification.groupBy({
      by: ['channel', 'status'],
      where: { campaignId },
      _count: { _all: true },
    }),
  ]);

  const summary = emptySummary();
  for (const group of grouped) {
    const channel = group.channel as NotificationChannel;
    const count = group._count._all;
    summary.channels[channel][group.status.toLowerCase() as 'sent' | 'skipped' | 'failed'] = count;
    summary.attempted += count;
    if (group.status === NotificationStatus.SENT) summary.sent += count;
    if (group.status === NotificationStatus.FAILED) summary.failed += count;
    if (group.status === NotificationStatus.SKIPPED) summary.skipped += count;
  }
  summary.recipients = new Set(rows.map((row) => row.patientId)).size;

  return {
    campaign,
    summary,
    notifications: rows.map((row) => ({
      notificationId: row.notificationId,
      patientId: row.patientId,
      patientName: row.patient.name,
      channel: row.channel,
      status: row.status,
      destination: row.destination,
      provider: row.provider,
      detail: row.detail,
      sentAt: row.sentAt?.toISOString() ?? null,
    })),
    truncated: rows.length === 200,
  };
}
