import crypto from 'node:crypto';
import { Prisma, RequestStatus, Severity } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { ValidatedEmergencyInput } from '../validation/emergency';
import { areaLabel } from './dashboardService';
import { rankRequests } from './priorityQueue';

/**
 * Request IDs are sequential per calendar year (REQ-2026-0001).
 * An advisory transaction lock serialises the read-then-insert, so two
 * simultaneous dispatchers can never receive the same ID.
 */
export async function nextRequestId(tx: Prisma.TransactionClient): Promise<string> {
  // Cast the void result so Prisma can deserialize it; the lock itself is held
  // until this transaction commits.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('goldenhour:request_id'))::text AS lock`;

  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const latest = await tx.emergencyRequest.findFirst({
    where: { requestId: { startsWith: prefix } },
    orderBy: { requestId: 'desc' },
    select: { requestId: true },
  });

  const previous = latest ? Number.parseInt(latest.requestId.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(previous) ? previous + 1 : 1;
  const requestId = `${prefix}${String(next).padStart(4, '0')}`;

  if (requestId.length > 20) {
    throw new Error('Request ID series exhausted for this year.');
  }
  return requestId;
}

export interface CreatedEmergency {
  requestId: string;
  status: RequestStatus;
  severity: Severity;
  createdAt: string;
  bloodGroupNeeded: string | null;
  medicineNeeded: string | null;
  location: { lat: number; lon: number; label: string };
  patient: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
  };
  /** Rank in the severity priority queue immediately after creation. */
  queuePosition: number | null;
}

/**
 * The patient row and its request are written in a single transaction, so a failure leaves neither behind.
 */
export async function createEmergencyRequest(
  input: ValidatedEmergencyInput,
  raisedBy: string,
  existingPatientId?: string,
): Promise<CreatedEmergency> {
  const created = await prisma.$transaction(async (tx) => {
    const requestId = await nextRequestId(tx);

    const patient = existingPatientId
      ? await tx.patient.findUniqueOrThrow({ where: { patientId: existingPatientId } })
      : await tx.patient.create({
          data: {
            patientId: `PAT-${crypto.randomBytes(6).toString('hex')}`,
            name: input.patientName,
            age: input.patientAge,
            contact: input.contact,
          },
        });

    const request = await tx.emergencyRequest.create({
      data: {
        requestId,
        patientId: patient.patientId,
        raisedBy,
        lat: input.lat,
        lon: input.lon,
        severity: input.severity,
        bloodGroupNeeded: input.bloodGroupNeeded,
        medicineNeeded: input.medicineNeeded,
        status: RequestStatus.QUEUED,
      },
      include: { patient: true },
    });

    return request;
  });

  // Raise the new call into the ranked queue so the receipt can show exactly
  // where it landed. This reads the committed row, not an estimate.
  const queued = await prisma.emergencyRequest.findMany({
    where: { status: RequestStatus.QUEUED },
    select: { requestId: true, severity: true, status: true, createdAt: true },
  });
  const queuePosition =
    rankRequests(queued).find((entry) => entry.item.requestId === created.requestId)
      ?.rank ?? null;

  return {
    requestId: created.requestId,
    status: created.status,
    severity: created.severity,
    createdAt: created.createdAt.toISOString(),
    bloodGroupNeeded: created.bloodGroupNeeded,
    medicineNeeded: created.medicineNeeded,
    location: {
      lat: created.lat,
      lon: created.lon,
      label: areaLabel(created.lat, created.lon),
    },
    patient: {
      patientId: created.patient.patientId,
      name: created.patient.name,
      age: created.patient.age,
      contact: created.patient.contact,
    },
    queuePosition,
  };
}

export async function listEmergencyRequests(filters: {
  status?: RequestStatus;
  severity?: Severity;
  limit: number;
}) {
  const where: Prisma.EmergencyRequestWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;

  const rows = await prisma.emergencyRequest.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
    take: filters.limit,
    include: { patient: true, assignment: { select: { assignmentId: true } } },
  });

  return rows.map((row) => ({
    requestId: row.requestId,
    status: row.status,
    severity: row.severity,
    createdAt: row.createdAt.toISOString(),
    waitingMinutes: Math.max(
      0,
      Math.round((Date.now() - row.createdAt.getTime()) / 60_000),
    ),
    bloodGroupNeeded: row.bloodGroupNeeded,
    medicineNeeded: row.medicineNeeded,
    location: {
      lat: row.lat,
      lon: row.lon,
      label: areaLabel(row.lat, row.lon),
    },
    patient: {
      patientId: row.patient.patientId,
      name: row.patient.name,
      age: row.patient.age,
      contact: row.patient.contact,
    },
    assignmentId: row.assignment?.assignmentId ?? null,
  }));
}
