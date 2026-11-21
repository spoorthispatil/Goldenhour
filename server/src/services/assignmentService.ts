import { AmbulanceStatus, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { etaMinutes, haversineKm } from '../utils/geo';
import { areaLabel } from '../utils/areas';
import { scoreHospital } from './readinessService';

export interface AssignmentInput {
  requestId: string;
  ambulanceId: string;
  hospitalId: string;
}

/** Domain failure with an HTTP status, thrown inside the transaction. */
export class AssignmentError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssignmentError';
  }
}

export interface AssignmentResult {
  status: 'assigned';
  assignmentId: string;
  requestId: string;
  ambulanceId: string;
  hospitalId: string;
  distanceKm: number;
  readinessScore: number;
  partialFlag: boolean;
  reason: string;
  assignedAt: string;
  ambulance: {
    ambulanceId: string;
    regNo: string;
    distanceKm: number;
    etaMinutes: number;
  };
  hospital: {
    hospitalId: string;
    name: string;
    area: string;
    remainingFreeBeds: number;
  };
  request: {
    requestId: string;
    patientName: string;
    patientAge: number;
    severity: string;
  };
}

/**
 * One transaction reserves the ambulance, the hospital bed and
 * the request.
 *
 * The rows are locked in a fixed order (request, ambulance, hospital) with
 * SELECT ... FOR UPDATE, so two dispatchers racing for the same ambulance are
 * serialised: the first commits BUSY, the second re-reads BUSY and is rejected.
 * The partial unique index `assignment_one_open_per_ambulance` and the unique
 * `assignment.request_id` are the database-level backstop if anything bypasses
 * this service.
 *
 * Readiness is recomputed here from current stock - client-supplied scores are
 * never trusted. distance_km stores the ambulance-to-emergency distance for the
 * dispatch leg; the reason records both legs and the readiness breakdown.
 */
export async function createAssignment(
  input: AssignmentInput,
): Promise<AssignmentResult> {
  return prisma.$transaction(async (tx) => {
    const requestLock = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM emergency_request WHERE request_id = ${input.requestId} FOR UPDATE`;
    if (requestLock.length === 0) {
      throw new AssignmentError(
        'REQUEST_NOT_FOUND',
        404,
        `No emergency request exists with id ${input.requestId}.`,
      );
    }

    const ambulanceLock = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM ambulance WHERE ambulance_id = ${input.ambulanceId} FOR UPDATE`;
    if (ambulanceLock.length === 0) {
      throw new AssignmentError(
        'AMBULANCE_NOT_FOUND',
        404,
        `No ambulance exists with id ${input.ambulanceId}.`,
      );
    }

    const hospitalLock = await tx.$queryRaw<{ free_beds: number }[]>`
      SELECT free_beds FROM hospital WHERE hospital_id = ${input.hospitalId} FOR UPDATE`;
    if (hospitalLock.length === 0) {
      throw new AssignmentError(
        'HOSPITAL_NOT_FOUND',
        404,
        `No hospital exists with id ${input.hospitalId}.`,
      );
    }

    const request = await tx.emergencyRequest.findUnique({
      where: { requestId: input.requestId },
      include: { patient: true, assignment: true },
    });
    if (!request) {
      throw new AssignmentError(
        'REQUEST_NOT_FOUND',
        404,
        `No emergency request exists with id ${input.requestId}.`,
      );
    }
    if (request.status === RequestStatus.CLOSED) {
      throw new AssignmentError(
        'REQUEST_CLOSED',
        409,
        `Emergency ${request.requestId} is closed and cannot be assigned.`,
      );
    }
    if (request.status === RequestStatus.ASSIGNED || request.assignment) {
      throw new AssignmentError(
        'REQUEST_ALREADY_ASSIGNED',
        409,
        `Emergency ${request.requestId} already has an assignment.`,
      );
    }
    if (request.status !== RequestStatus.QUEUED) {
      throw new AssignmentError(
        'REQUEST_NOT_QUEUED',
        409,
        `Emergency ${request.requestId} is ${request.status}; only QUEUED calls can be assigned.`,
      );
    }
    if (ambulanceLock[0]!.status !== AmbulanceStatus.AVAILABLE) {
      throw new AssignmentError(
        'AMBULANCE_NOT_AVAILABLE',
        409,
        `Ambulance ${input.ambulanceId} is ${ambulanceLock[0]!.status}. Only AVAILABLE ambulances can be dispatched.`,
      );
    }
    if (hospitalLock[0]!.free_beds <= 0) {
      throw new AssignmentError(
        'HOSPITAL_NO_BEDS',
        409,
        `Hospital ${input.hospitalId} has no free beds, so the bed cannot be reserved.`,
      );
    }

    const ambulance = await tx.ambulance.findUniqueOrThrow({
      where: { ambulanceId: input.ambulanceId },
    });
    const hospital = await tx.hospital.findUniqueOrThrow({
      where: { hospitalId: input.hospitalId },
      include: { bloodStock: true, medicineStock: true },
    });

    // Recompute readiness from the locked hospital stock; never trust the client.
    const readiness = scoreHospital(hospital, {
      requestId: request.requestId,
      lat: request.lat,
      lon: request.lon,
      bloodGroupNeeded: request.bloodGroupNeeded,
      medicineNeeded: request.medicineNeeded,
    });
    const ambulanceDistanceKm = haversineKm(
      { lat: request.lat, lon: request.lon },
      { lat: ambulance.lat, lon: ambulance.lon },
    );
    const eta = etaMinutes(ambulanceDistanceKm);
    const reason = `Ambulance ${ambulance.regNo} is ${ambulanceDistanceKm.toFixed(2)} km from the emergency (ETA ${eta} min); ${readiness.reason}.`;

    const assignment = await tx.assignment.create({
      data: {
        requestId: request.requestId,
        ambulanceId: ambulance.ambulanceId,
        hospitalId: hospital.hospitalId,
        distanceKm: new Prisma.Decimal(ambulanceDistanceKm),
        readinessScore: Math.round(readiness.score),
        partialFlag: readiness.partialFlag,
        reason,
      },
    });

    await tx.ambulance.update({
      where: { ambulanceId: ambulance.ambulanceId },
      data: { status: AmbulanceStatus.BUSY },
    });
    await tx.emergencyRequest.update({
      where: { requestId: request.requestId },
      data: { status: RequestStatus.ASSIGNED },
    });
    const updatedHospital = await tx.hospital.update({
      where: { hospitalId: hospital.hospitalId },
      data: { freeBeds: { decrement: 1 } },
    });

    return {
      status: 'assigned' as const,
      assignmentId: assignment.assignmentId,
      requestId: assignment.requestId,
      ambulanceId: assignment.ambulanceId,
      hospitalId: assignment.hospitalId,
      distanceKm: Number(assignment.distanceKm),
      readinessScore: assignment.readinessScore,
      partialFlag: assignment.partialFlag,
      reason: assignment.reason,
      assignedAt: assignment.assignedAt.toISOString(),
      ambulance: {
        ambulanceId: ambulance.ambulanceId,
        regNo: ambulance.regNo,
        distanceKm: ambulanceDistanceKm,
        etaMinutes: eta,
      },
      hospital: {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        area: areaLabel(hospital.lat, hospital.lon),
        remainingFreeBeds: updatedHospital.freeBeds,
      },
      request: {
        requestId: request.requestId,
        patientName: request.patient.name,
        patientAge: request.patient.age,
        severity: request.severity,
      },
    };
  });
}

export interface ClosureResult {
  status: 'closed';
  assignmentId: string;
  requestId: string;
  closedAt: string;
  requestStatus: 'CLOSED';
  ambulance: { ambulanceId: string; regNo: string; status: string };
  hospital: {
    hospitalId: string;
    name: string;
    freeBeds: number;
    releasedBed: boolean;
  };
}

/**
 * Closing a case releases the ambulance and the reserved bed.
 *
 * The assignment row is locked first, then the request, ambulance and hospital
 * rows in the same order the dispatch transaction uses, so a closure can never
 * interleave with a new dispatch into an impossible bed count. Closing twice is
 * refused. The bed is restored with a clamp at `total_beds`: if hospital staff
 * already raised free beds while the case was open, the count can never exceed
 * capacity.
 */
export async function closeAssignment(
  assignmentId: string,
): Promise<ClosureResult> {
  return prisma.$transaction(async (tx) => {
    const assignmentLock = await tx.$queryRaw<
      {
        request_id: string;
        hospital_id: string;
        ambulance_id: string;
        closed_at: Date | null;
      }[]
    >`
      SELECT request_id, hospital_id, ambulance_id, closed_at
      FROM assignment WHERE assignment_id = ${assignmentId} FOR UPDATE`;

    if (assignmentLock.length === 0) {
      throw new AssignmentError(
        'ASSIGNMENT_NOT_FOUND',
        404,
        `No assignment exists with id ${assignmentId}.`,
      );
    }
    const locked = assignmentLock[0]!;
    if (locked.closed_at) {
      throw new AssignmentError(
        'ASSIGNMENT_ALREADY_CLOSED',
        409,
        `Case ${locked.request_id} was already closed at ${locked.closed_at.toISOString()}.`,
      );
    }

    // Same lock order as createAssignment: request, ambulance, hospital.
    await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM emergency_request WHERE request_id = ${locked.request_id} FOR UPDATE`;
    const ambulanceLock = await tx.$queryRaw<
      { status: string; reg_no: string }[]
    >`
      SELECT status, reg_no FROM ambulance WHERE ambulance_id = ${locked.ambulance_id} FOR UPDATE`;
    const hospitalLock = await tx.$queryRaw<
      { free_beds: number; total_beds: number; name: string }[]
    >`
      SELECT free_beds, total_beds, name FROM hospital WHERE hospital_id = ${locked.hospital_id} FOR UPDATE`;

    if (ambulanceLock.length === 0 || hospitalLock.length === 0) {
      throw new AssignmentError(
        'ASSIGNMENT_INCONSISTENT',
        409,
        'The assignment references an ambulance or hospital that no longer exists.',
      );
    }

    const closedAt = new Date();
    await tx.assignment.update({
      where: { assignmentId },
      data: { closedAt },
    });
    await tx.emergencyRequest.update({
      where: { requestId: locked.request_id },
      data: { status: RequestStatus.CLOSED },
    });

    // A BUSY vehicle returns to the fleet; an OFFLINE vehicle stays offline.
    let ambulanceStatus = ambulanceLock[0]!.status;
    if (ambulanceStatus === AmbulanceStatus.BUSY) {
      ambulanceStatus = AmbulanceStatus.AVAILABLE;
      await tx.ambulance.update({
        where: { ambulanceId: locked.ambulance_id },
        data: { status: AmbulanceStatus.AVAILABLE },
      });
    }

    const hospital = hospitalLock[0]!;
    const nextFreeBeds = Math.min(hospital.total_beds, hospital.free_beds + 1);
    const updatedHospital = await tx.hospital.update({
      where: { hospitalId: locked.hospital_id },
      data: { freeBeds: nextFreeBeds },
    });

    return {
      status: 'closed' as const,
      assignmentId,
      requestId: locked.request_id,
      closedAt: closedAt.toISOString(),
      requestStatus: 'CLOSED' as const,
      ambulance: {
        ambulanceId: locked.ambulance_id,
        regNo: ambulanceLock[0]!.reg_no,
        status: ambulanceStatus,
      },
      hospital: {
        hospitalId: locked.hospital_id,
        name: hospital.name,
        freeBeds: updatedHospital.freeBeds,
        releasedBed: nextFreeBeds > hospital.free_beds,
      },
    };
  });
}

/** Assignment desk history: open cases first, then the most recent closures. */
export async function listAssignments(limit = 20) {
  const rows = await prisma.assignment.findMany({
    // Open cases (closedAt IS NULL) first, then the newest assignments.
    orderBy: [
      { closedAt: { sort: 'asc', nulls: 'first' } },
      { assignedAt: 'desc' },
    ],
    take: limit,
    include: {
      ambulance: true,
      hospital: true,
      request: { include: { patient: true } },
    },
  });

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    requestId: row.requestId,
    patientName: row.request.patient.name,
    severity: row.request.severity,
    ambulanceRegNo: row.ambulance.regNo,
    hospitalName: row.hospital.name,
    distanceKm: Number(row.distanceKm),
    readinessScore: row.readinessScore,
    partialFlag: row.partialFlag,
    reason: row.reason,
    assignedAt: row.assignedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  }));
}
