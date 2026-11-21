import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { HospitalResourcesInput } from '../validation/hospitalResources';
import type { HospitalDatasetInput } from '../validation/hospitalDataset';

export class HospitalResourceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HospitalResourceError';
  }
}

export interface HospitalResourcesPayload {
  status: 'updated';
  hospital: {
    hospitalId: string;
    name: string;
    freeBeds: number;
    totalBeds: number;
    bloodStock: { group: string; units: number }[];
    medicineStock: { medicine: string; units: number }[];
  };
  changes: {
    freeBeds: number | null;
    bloodStock: number;
    medicineStock: number;
  };
}

export async function getHospitalResources(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { hospitalId },
    include: {
      bloodStock: { orderBy: { bloodGroup: 'asc' } },
      medicineStock: { orderBy: { medicine: 'asc' } },
    },
  });
  if (!hospital) return null;

  return {
    hospital: {
      hospitalId: hospital.hospitalId,
      name: hospital.name,
      freeBeds: hospital.freeBeds,
      totalBeds: hospital.totalBeds,
      bloodStock: hospital.bloodStock.map((row) => ({
        group: row.bloodGroup,
        units: row.units,
      })),
      medicineStock: hospital.medicineStock.map((row) => ({
        medicine: row.medicine,
        units: row.units,
      })),
    },
    limits: { maxUnits: 9999 },
  };
}

/**
 * Hospital staff keep beds, blood and medicine current.
 *
 * The hospital row is locked FOR UPDATE for the whole edit - the same row the
 * assignment transaction locks before decrementing free beds - so an edit and a
 * dispatch can never interleave into an impossible count. All requested changes
 * are applied in one transaction; a failed medicine lookup rolls everything back.
 */
export async function updateHospitalResources(
  hospitalId: string,
  input: HospitalResourcesInput,
): Promise<HospitalResourcesPayload> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ total_beds: number }[]>`
      SELECT total_beds FROM hospital WHERE hospital_id = ${hospitalId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new HospitalResourceError(
        'HOSPITAL_NOT_FOUND',
        404,
        `No hospital exists with id ${hospitalId}.`,
      );
    }

    const hospital = await tx.hospital.findUniqueOrThrow({
      where: { hospitalId },
      include: { bloodStock: true, medicineStock: true },
    });

    if (input.freeBeds !== undefined && input.freeBeds > hospital.totalBeds) {
      throw new HospitalResourceError(
        'FREE_BEDS_EXCEEDS_TOTAL',
        400,
        `Free beds cannot exceed the hospital's ${hospital.totalBeds} licensed beds.`,
      );
    }

    // A hospital may add a medicine that is not tracked yet; an existing name
    // is matched case-insensitively so it is updated rather than duplicated.
    const medicineUpdates: { medicine: string; units: number }[] = [];
    for (const entry of input.medicineStock ?? []) {
      const existing = hospital.medicineStock.find(
        (row) => row.medicine.toLowerCase() === entry.medicine.toLowerCase(),
      );
      medicineUpdates.push({
        medicine: existing?.medicine ?? entry.medicine,
        units: entry.units,
      });
    }

    if (input.freeBeds !== undefined) {
      await tx.hospital.update({
        where: { hospitalId },
        data: { freeBeds: input.freeBeds },
      });
    }

    for (const entry of input.bloodStock ?? []) {
      await tx.bloodStock.upsert({
        where: {
          hospitalId_bloodGroup: { hospitalId, bloodGroup: entry.group },
        },
        create: { hospitalId, bloodGroup: entry.group, units: entry.units },
        update: { units: entry.units },
      });
    }

    for (const entry of medicineUpdates) {
      await tx.medicineStock.upsert({
        where: {
          hospitalId_medicine: { hospitalId, medicine: entry.medicine },
        },
        create: {
          hospitalId,
          medicine: entry.medicine,
          units: entry.units,
        },
        update: { units: entry.units },
      });
    }

    const updated = await tx.hospital.findUniqueOrThrow({
      where: { hospitalId },
      include: {
        bloodStock: { orderBy: { bloodGroup: 'asc' } },
        medicineStock: { orderBy: { medicine: 'asc' } },
      },
    });

    return {
      status: 'updated' as const,
      hospital: {
        hospitalId: updated.hospitalId,
        name: updated.name,
        freeBeds: updated.freeBeds,
        totalBeds: updated.totalBeds,
        bloodStock: updated.bloodStock.map((row) => ({
          group: row.bloodGroup,
          units: row.units,
        })),
        medicineStock: updated.medicineStock.map((row) => ({
          medicine: row.medicine,
          units: row.units,
        })),
      },
      changes: {
        freeBeds: input.freeBeds ?? null,
        bloodStock: input.bloodStock?.length ?? 0,
        medicineStock: medicineUpdates.length,
      },
    };
  });
}

export type DeletableResourceKind = 'blood' | 'medicine';

/** Shapes the locked hospital (and its stock) for an API response. */
function serializeResources(hospital: {
  hospitalId: string;
  name: string;
  freeBeds: number;
  totalBeds: number;
  bloodStock: { bloodGroup: string; units: number }[];
  medicineStock: { medicine: string; units: number }[];
}) {
  return {
    hospitalId: hospital.hospitalId,
    name: hospital.name,
    freeBeds: hospital.freeBeds,
    totalBeds: hospital.totalBeds,
    bloodStock: hospital.bloodStock.map((row) => ({
      group: row.bloodGroup,
      units: row.units,
    })),
    medicineStock: hospital.medicineStock.map((row) => ({
      medicine: row.medicine,
      units: row.units,
    })),
  };
}

/**
 * Removes one tracked blood group or medicine from a hospital's dataset.
 *
 * Staff can add and update rows individually, so they must be able to remove a
 * row they no longer stock without re-importing the whole dataset. The hospital
 * row is locked for the delete, the row is scoped to the session's hospital, and
 * a row that is not tracked returns 404 instead of silently succeeding. Readiness
 * matching reads the remaining rows immediately, so a removed blood group counts
 * as "not in stock" on the next match.
 */
export async function deleteHospitalResource(
  hospitalId: string,
  kind: DeletableResourceKind,
  name: string,
): Promise<HospitalResourcesPayload> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ total_beds: number }[]>`
      SELECT total_beds FROM hospital WHERE hospital_id = ${hospitalId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new HospitalResourceError(
        'HOSPITAL_NOT_FOUND',
        404,
        `No hospital exists with id ${hospitalId}.`,
      );
    }

    if (kind === 'blood') {
      const removed = await tx.bloodStock.deleteMany({
        where: { hospitalId, bloodGroup: name },
      });
      if (removed.count === 0) {
        throw new HospitalResourceError(
          'BLOOD_GROUP_NOT_TRACKED',
          404,
          `${name} is not tracked for this hospital.`,
        );
      }
    } else {
      const existing = await tx.medicineStock.findFirst({
        where: { hospitalId, medicine: { equals: name, mode: 'insensitive' } },
      });
      if (!existing) {
        throw new HospitalResourceError(
          'MEDICINE_NOT_TRACKED',
          404,
          `${name} is not tracked for this hospital.`,
        );
      }
      await tx.medicineStock.delete({
        where: {
          hospitalId_medicine: {
            hospitalId,
            medicine: existing.medicine,
          },
        },
      });
    }

    const updated = await tx.hospital.findUniqueOrThrow({
      where: { hospitalId },
      include: {
        bloodStock: { orderBy: { bloodGroup: 'asc' } },
        medicineStock: { orderBy: { medicine: 'asc' } },
      },
    });

    return {
      status: 'updated' as const,
      hospital: serializeResources(updated),
      changes: {
        freeBeds: null,
        bloodStock: kind === 'blood' ? -1 : 0,
        medicineStock: kind === 'medicine' ? -1 : 0,
      },
    };
  });
}

/**
 * Replaces a hospital's complete dataset in one transaction: total beds, free
 * beds, blood units and medicine rows. Used for the first load and for a full
 * refresh from CSV or JSON; individual edits use updateHospitalResources.
 */
export async function importHospitalDataset(
  hospitalId: string,
  input: HospitalDatasetInput,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ total_beds: number }[]>`
      SELECT total_beds FROM hospital WHERE hospital_id = ${hospitalId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new HospitalResourceError(
        'HOSPITAL_NOT_FOUND',
        404,
        `No hospital exists with id ${hospitalId}.`,
      );
    }

    await tx.hospital.update({
      where: { hospitalId },
      data: { totalBeds: input.totalBeds, freeBeds: input.freeBeds },
    });

    // The dataset is authoritative: rows that are no longer present disappear.
    await tx.bloodStock.deleteMany({ where: { hospitalId } });
    await tx.medicineStock.deleteMany({ where: { hospitalId } });

    if (input.bloodStock.length > 0) {
      await tx.bloodStock.createMany({
        data: input.bloodStock.map((row) => ({
          hospitalId,
          bloodGroup: row.group,
          units: row.units,
        })),
      });
    }
    if (input.medicineStock.length > 0) {
      await tx.medicineStock.createMany({
        data: input.medicineStock.map((row) => ({
          hospitalId,
          medicine: row.medicine,
          units: row.units,
        })),
      });
    }

    const updated = await tx.hospital.findUniqueOrThrow({
      where: { hospitalId },
      include: {
        bloodStock: { orderBy: { bloodGroup: 'asc' } },
        medicineStock: { orderBy: { medicine: 'asc' } },
      },
    });

    return {
      status: 'imported' as const,
      hospital: {
        hospitalId: updated.hospitalId,
        name: updated.name,
        freeBeds: updated.freeBeds,
        totalBeds: updated.totalBeds,
        bloodStock: updated.bloodStock.map((row) => ({
          group: row.bloodGroup,
          units: row.units,
        })),
        medicineStock: updated.medicineStock.map((row) => ({
          medicine: row.medicine,
          units: row.units,
        })),
      },
      imported: {
        bloodStock: input.bloodStock.length,
        medicineStock: input.medicineStock.length,
      },
    };
  });
}

/** Prisma's P2002 is surfaced by the route as a 409 if a race slips through. */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
