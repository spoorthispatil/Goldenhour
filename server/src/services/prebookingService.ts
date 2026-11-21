import { PrebookingStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { PrebookingAction, PrebookingInput } from '../validation/patient';
import { PREBOOKING_SLOT_MINUTES } from '../validation/patient';

export class PortalError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PortalError';
  }
}

/** Statuses that still hold (or are asking for) a bed. */
const ACTIVE: PrebookingStatus[] = [
  PrebookingStatus.PENDING,
  PrebookingStatus.CONFIRMED,
  PrebookingStatus.CANCEL_REQUESTED,
  PrebookingStatus.ADMITTED,
];

const LABELS: Record<PrebookingStatus, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  CANCEL_REQUESTED: 'cancellation-requested',
  ADMITTED: 'admitted',
  DISCHARGED: 'discharged',
};

interface PrebookingRow {
  prebookingId: string;
  reason: string;
  slotStart: Date | null;
  slotEnd: Date | null;
  status: PrebookingStatus;
  createdAt: Date;
  decidedAt: Date | null;
  admittedAt: Date | null;
  dischargedAt: Date | null;
  cancellationReason: string | null;
  hospital: {
    hospitalId: string;
    name: string;
    lat: number;
    lon: number;
    freeBeds: number;
    totalBeds: number;
  };
  patient?: { patientId: string; name: string; age: number; contact: string };
}

function mapPrebooking(row: PrebookingRow) {
  return {
    prebookingId: row.prebookingId,
    reason: row.reason,
    slotStart: row.slotStart?.toISOString() ?? null,
    slotEnd: row.slotEnd?.toISOString() ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    admittedAt: row.admittedAt?.toISOString() ?? null,
    dischargedAt: row.dischargedAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    hospital: {
      hospitalId: row.hospital.hospitalId,
      name: row.hospital.name,
      lat: row.hospital.lat,
      lon: row.hospital.lon,
      freeBeds: row.hospital.freeBeds,
      totalBeds: row.hospital.totalBeds,
    },
    patient: row.patient
      ? {
          patientId: row.patient.patientId,
          name: row.patient.name,
          age: row.patient.age,
          contact: row.patient.contact,
        }
      : undefined,
  };
}

const hospitalSelect = {
  hospitalId: true,
  name: true,
  lat: true,
  lon: true,
  freeBeds: true,
  totalBeds: true,
} as const;

const patientSelect = {
  patientId: true,
  name: true,
  age: true,
  contact: true,
} as const;

/** A patient asks a hospital to reserve a bed for a one-hour slot. The request
 * starts PENDING; a bed is only reserved when hospital staff confirm it. */
export async function createPrebooking(patientId: string, input: PrebookingInput) {
  return prisma.$transaction(async (tx) => {
    const hospital = await tx.hospital.findUnique({
      where: { hospitalId: input.hospitalId },
      select: { ...hospitalSelect },
    });
    if (!hospital) {
      throw new PortalError('HOSPITAL_NOT_FOUND', 404, 'That hospital does not exist.');
    }
    if (hospital.freeBeds <= 0) {
      throw new PortalError(
        'NO_FREE_BEDS',
        409,
        'That hospital has no free beds right now. Try another hospital.',
      );
    }

    const active = await tx.prebooking.findFirst({
      where: {
        patientId,
        hospitalId: input.hospitalId,
        status: { in: ACTIVE },
      },
      select: { prebookingId: true },
    });
    if (active) {
      throw new PortalError(
        'ALREADY_PREBOOKED',
        409,
        'You already have an active pre-booking at this hospital.',
      );
    }

    const created = await tx.prebooking.create({
      data: {
        patientId,
        hospitalId: input.hospitalId,
        reason: input.reason,
        slotStart: input.slotStart,
        slotEnd: new Date(input.slotStart.getTime() + PREBOOKING_SLOT_MINUTES * 60_000),
      },
      include: { hospital: { select: hospitalSelect } },
    });
    return mapPrebooking(created);
  });
}

export async function listPatientPrebookings(patientId: string) {
  const rows = await prisma.prebooking.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { hospital: { select: hospitalSelect } },
  });
  return rows.map(mapPrebooking);
}

export async function listHospitalPrebookings(hospitalId: string) {
  const rows = await prisma.prebooking.findMany({
    where: { hospitalId },
    orderBy: [{ status: 'asc' }, { slotStart: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      hospital: { select: hospitalSelect },
      patient: { select: patientSelect },
    },
  });
  return rows.map(mapPrebooking);
}

/**
 * Patient-side cancellation.
 *
 * A PENDING request has no bed reserved, so it is cancelled immediately. A
 * CONFIRMED booking already holds a bed, so cancelling becomes a request the
 * hospital answers: the bed stays reserved until staff approve it, which is the
 * only way a patient can give up a bed they already hold.
 */
export async function cancelPrebooking(
  patientId: string,
  prebookingId: string,
  reason: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: PrebookingStatus }[]>`
      SELECT status FROM prebooking
      WHERE prebooking_id = ${prebookingId} AND patient_id = ${patientId}
      FOR UPDATE`;
    if (locked.length === 0) {
      throw new PortalError(
        'PREBOOKING_NOT_FOUND',
        404,
        'No pre-booking with that id belongs to you.',
      );
    }

    const row = await tx.prebooking.findUniqueOrThrow({
      where: { prebookingId },
      include: { hospital: { select: hospitalSelect } },
    });

    if (row.status === PrebookingStatus.PENDING) {
      const updated = await tx.prebooking.update({
        where: { prebookingId },
        data: {
          status: PrebookingStatus.CANCELLED,
          decidedAt: new Date(),
          cancellationReason: reason,
        },
        include: { hospital: { select: hospitalSelect } },
      });
      return { prebooking: mapPrebooking(updated), requested: false };
    }

    if (row.status === PrebookingStatus.CONFIRMED) {
      const updated = await tx.prebooking.update({
        where: { prebookingId },
        data: {
          status: PrebookingStatus.CANCEL_REQUESTED,
          cancellationReason: reason,
        },
        include: { hospital: { select: hospitalSelect } },
      });
      return { prebooking: mapPrebooking(updated), requested: true };
    }

    throw new PortalError(
      'NOT_CANCELLABLE',
      409,
      row.status === PrebookingStatus.ADMITTED
        ? 'You are already admitted. Ask the hospital to discharge you.'
        : `This pre-booking is already ${LABELS[row.status]}.`,
    );
  });
}

/**
 * Hospital-side transitions. One endpoint covers every step so the bed
 * accounting stays in a single locked transaction:
 *
 *   PENDING      -> CONFIRMED (reserves 1 bed) | DECLINED
 *   CONFIRMED    -> ADMITTED                   | CANCEL_REQUESTED (patient)
 *   CANCEL_REQUESTED -> CANCELLED (releases bed) | CONFIRMED (request rejected)
 *   ADMITTED     -> DISCHARGED (releases bed)
 */
export async function decidePrebooking(
  hospitalId: string,
  prebookingId: string,
  action: PrebookingAction,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: PrebookingStatus }[]>`
      SELECT status FROM prebooking
      WHERE prebooking_id = ${prebookingId} AND hospital_id = ${hospitalId}
      FOR UPDATE`;
    if (locked.length === 0) {
      throw new PortalError(
        'PREBOOKING_NOT_FOUND',
        404,
        'No pre-booking with that id belongs to your hospital.',
      );
    }

    const row = await tx.prebooking.findUniqueOrThrow({
      where: { prebookingId },
      include: {
        hospital: { select: hospitalSelect },
        patient: { select: patientSelect },
      },
    });

    const require = (allowed: PrebookingStatus[]) => {
      if (!allowed.includes(row.status)) {
        throw new PortalError(
          'INVALID_TRANSITION',
          409,
          `This pre-booking is ${LABELS[row.status]} and cannot be changed that way.`,
        );
      }
    };

    const releaseBed = async () => {
      await tx.$queryRaw`
        SELECT total_beds FROM hospital WHERE hospital_id = ${hospitalId} FOR UPDATE`;
      await tx.$executeRaw`
        UPDATE hospital
        SET free_beds = LEAST(total_beds, free_beds + 1)
        WHERE hospital_id = ${hospitalId}`;
    };

    let data: {
      status: PrebookingStatus;
      decidedAt?: Date;
      admittedAt?: Date;
      dischargedAt?: Date;
      cancellationReason?: string | null;
    };

    switch (action) {
      case 'CONFIRM': {
        require([PrebookingStatus.PENDING]);
        await tx.$queryRaw`
          SELECT free_beds FROM hospital WHERE hospital_id = ${hospitalId} FOR UPDATE`;
        const hospital = await tx.hospital.findUniqueOrThrow({
          where: { hospitalId },
          select: { freeBeds: true },
        });
        if (hospital.freeBeds <= 0) {
          throw new PortalError(
            'NO_FREE_BEDS',
            409,
            'There are no free beds left to reserve.',
          );
        }
        await tx.hospital.update({
          where: { hospitalId },
          data: { freeBeds: { decrement: 1 } },
        });
        data = { status: PrebookingStatus.CONFIRMED, decidedAt: new Date() };
        break;
      }
      case 'DECLINE':
        require([PrebookingStatus.PENDING]);
        data = { status: PrebookingStatus.DECLINED, decidedAt: new Date() };
        break;
      case 'ADMIT':
        require([PrebookingStatus.CONFIRMED]);
        data = { status: PrebookingStatus.ADMITTED, admittedAt: new Date() };
        break;
      case 'DISCHARGE':
        require([PrebookingStatus.ADMITTED]);
        await releaseBed();
        data = { status: PrebookingStatus.DISCHARGED, dischargedAt: new Date() };
        break;
      case 'APPROVE_CANCELLATION':
        require([PrebookingStatus.CANCEL_REQUESTED]);
        await releaseBed();
        data = { status: PrebookingStatus.CANCELLED, decidedAt: new Date() };
        break;
      case 'REJECT_CANCELLATION':
        require([PrebookingStatus.CANCEL_REQUESTED]);
        data = { status: PrebookingStatus.CONFIRMED, cancellationReason: null };
        break;
    }

    const updated = await tx.prebooking.update({
      where: { prebookingId },
      data,
      include: {
        hospital: { select: hospitalSelect },
        patient: { select: patientSelect },
      },
    });
    return mapPrebooking(updated);
  });
}
