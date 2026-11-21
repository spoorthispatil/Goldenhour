import { RequestStatus, Severity } from '@prisma/client';
import { prisma } from '../db/prisma';
import { etaMinutes, haversineKm } from '../utils/geo';
import { areaLabel } from '../utils/areas';
import { SEVERITY_WEIGHT } from '../types';
import { rankRequests } from './priorityQueue';
import type { BloodGroup } from '../types';

// Re-exported for existing callers; the implementation is Prisma-free so pure
// scoring checks can import it without a database connection.
export { areaLabel } from '../utils/areas';

export async function buildDispatcherDashboard(now = Date.now()) {
  const openWhere = { status: { not: RequestStatus.CLOSED } } as const;

  const [
    queueRows,
    assignmentRows,
    ambulanceRows,
    hospitalRows,
    openCount,
    criticalCount,
    pendingCount,
    activeAssignmentCount,
    severityGroups,
    recentVolume,
  ] = await Promise.all([
    prisma.emergencyRequest.findMany({
      where: openWhere,
      include: { patient: true },
      // Newest first for the activity feed; queue order comes from the shared
      // ranking module so every screen sorts identically.
      orderBy: { createdAt: 'desc' },
    }),
    prisma.assignment.findMany({
      orderBy: { assignedAt: 'desc' },
      include: {
        ambulance: true,
        hospital: true,
        request: { include: { patient: true } },
      },
    }),
    prisma.ambulance.findMany({ orderBy: { ambulanceId: 'asc' } }),
    prisma.hospital.findMany({
      orderBy: { hospitalId: 'asc' },
      include: { bloodStock: true, medicineStock: true },
    }),
    prisma.emergencyRequest.count({ where: openWhere }),
    prisma.emergencyRequest.count({
      where: { ...openWhere, severity: Severity.CRITICAL },
    }),
    prisma.emergencyRequest.count({
      where: { status: RequestStatus.QUEUED },
    }),
    prisma.assignment.count({ where: { closedAt: null } }),
    prisma.emergencyRequest.groupBy({
      by: ['severity'],
      where: openWhere,
      _count: { _all: true },
    }),
    prisma.emergencyRequest.findMany({
      where: { createdAt: { gte: new Date(now - 8 * 3_600_000) } },
      select: { createdAt: true },
    }),
  ]);

  // Only QUEUED calls are ranked here, so the dashboard rank of a call always
  // matches the rank on the dedicated queue board (assigned cases are listed
  // separately under recent assignments).
  const queue = rankRequests(
    queueRows.filter((row) => row.status === RequestStatus.QUEUED),
    now,
  ).map(
    ({ item: row, rank, severityWeight, waitingMinutes, priorityScore }) => ({
      rank,
      requestId: row.requestId,
      patientName: row.patient.name,
      patientAge: row.patient.age,
      severity: row.severity,
      severityWeight,
      priorityScore,
      status: row.status,
      waitingMinutes,
      createdAt: row.createdAt.toISOString(),
      location: {
        lat: row.lat,
        lon: row.lon,
        label: areaLabel(row.lat, row.lon),
      },
      bloodGroupNeeded: row.bloodGroupNeeded as BloodGroup | null,
      medicineNeeded: row.medicineNeeded,
    }),
  );

  const latestQueued = queue
    .filter((row) => row.status === RequestStatus.QUEUED)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const availability = {
    AVAILABLE: ambulanceRows.filter((row) => row.status === 'AVAILABLE').length,
    BUSY: ambulanceRows.filter((row) => row.status === 'BUSY').length,
    OFFLINE: ambulanceRows.filter((row) => row.status === 'OFFLINE').length,
  };

  const severityBreakdown = ([
    Severity.CRITICAL,
    Severity.HIGH,
    Severity.MEDIUM,
    Severity.LOW,
  ] as Severity[]).map((severity) => ({
    severity,
    weight: SEVERITY_WEIGHT[severity],
    count: severityGroups.find((group) => group.severity === severity)?._count._all ?? 0,
  }));

  const hourBuckets = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(now - (7 - index) * 3_600_000);
    start.setMinutes(0, 0, 0);
    return {
      label: start.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      start: start.getTime(),
      emergencies: 0,
    };
  });

  for (const row of recentVolume) {
    const created = row.createdAt.getTime();
    const bucket = hourBuckets.find(
      (candidate, index) =>
        created >= candidate.start &&
        (index === hourBuckets.length - 1 ||
          created < (hourBuckets[index + 1]?.start ?? Number.POSITIVE_INFINITY)),
    );
    if (bucket) bucket.emergencies += 1;
  }

  const statusFeed = buildFeed(queueRows, assignmentRows, hospitalRows);

  return {
    role: 'DISPATCHER' as const,
    dataSource: 'postgresql' as const,
    generatedAt: new Date(now).toISOString(),
    refreshIntervalSeconds: 5,
    stats: {
      totalEmergencies: openCount,
      criticalEmergencies: criticalCount,
      pendingRequests: pendingCount,
      activeAssignments: activeAssignmentCount,
      availableAmbulances: availability.AVAILABLE,
      busyAmbulances: availability.BUSY,
      offlineAmbulances: availability.OFFLINE,
      totalHospitals: hospitalRows.length,
      freeBeds: hospitalRows.reduce((sum, hospital) => sum + hospital.freeBeds, 0),
    },
    queue,
    assignments: assignmentRows.map((row) => ({
      assignmentId: row.assignmentId,
      requestId: row.requestId,
      patientName: row.request.patient.name,
      severity: row.request.severity,
      hospitalName: row.hospital.name,
      ambulanceRegNo: row.ambulance.regNo,
      distanceKm: Number(row.distanceKm),
      readinessScore: row.readinessScore,
      partialFlag: row.partialFlag,
      reason: row.reason,
      assignedAt: row.assignedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    })),
    ambulances: ambulanceRows.map((row) => ({
      ambulanceId: row.ambulanceId,
      regNo: row.regNo,
      status: row.status,
      location: {
        lat: row.lat,
        lon: row.lon,
        label: areaLabel(row.lat, row.lon),
      },
      distanceKmToLatestRequest: latestQueued
        ? haversineKm(
            { lat: row.lat, lon: row.lon },
            { lat: latestQueued.location.lat, lon: latestQueued.location.lon },
          )
        : null,
    })),
    hospitals: hospitalRows.map((row) => ({
      hospitalId: row.hospitalId,
      name: row.name,
      area: areaLabel(row.lat, row.lon),
      totalBeds: row.totalBeds,
      freeBeds: row.freeBeds,
      bloodUnits: row.bloodStock.reduce((sum, stock) => sum + stock.units, 0),
      oPositiveUnits: row.bloodStock.find((stock) => stock.bloodGroup === 'O+')?.units ?? 0,
      adrenalineUnits:
        row.medicineStock.find((stock) => stock.medicine === 'Adrenaline')?.units ?? 0,
      medicinesTracked: row.medicineStock.filter((stock) => stock.units > 0).length,
    })),
    severityBreakdown,
    volumeByHour: hourBuckets.map(({ label, emergencies }) => ({ label, emergencies })),
    statusFeed,
  };
}

function buildFeed(
  requests: Awaited<ReturnType<typeof prisma.emergencyRequest.findMany>> & {
    patient?: { name: string };
  }[],
  assignments: {
    requestId: string;
    assignedAt: Date;
    closedAt: Date | null;
    partialFlag: boolean;
    readinessScore: number;
    hospital: { name: string };
    ambulance: { regNo: string };
  }[],
  hospitals: { name: string; freeBeds: number }[],
) {
  const feed: {
    id: string;
    at: string;
    tone: 'info' | 'critical' | 'success' | 'warning';
    message: string;
  }[] = [];

  const newest = requests[0];
  if (newest) {
    feed.push({
      id: `request-${newest.requestId}`,
      at: newest.createdAt.toISOString(),
      tone: newest.severity === 'CRITICAL' ? 'critical' : 'info',
      message: `New ${newest.severity} call ${newest.requestId} from ${areaLabel(
        newest.lat,
        newest.lon,
      )} joined the priority queue.`,
    });
  }

  for (const assignment of assignments.slice(0, 4)) {
    if (assignment.closedAt) {
      feed.push({
        id: `closed-${assignment.requestId}`,
        at: assignment.closedAt.toISOString(),
        tone: 'success',
        message: `Case ${assignment.requestId} closed; ambulance ${assignment.ambulance.regNo} and one bed at ${assignment.hospital.name} released.`,
      });
    } else {
      feed.push({
        id: `assigned-${assignment.requestId}`,
        at: assignment.assignedAt.toISOString(),
        tone: assignment.partialFlag ? 'warning' : 'success',
        message: `Ambulance ${assignment.ambulance.regNo} reserved for ${assignment.requestId} to ${assignment.hospital.name} (${assignment.readinessScore}/100${assignment.partialFlag ? ', partial readiness' : ''}).`,
      });
    }
  }

  for (const hospital of hospitals.filter((row) => row.freeBeds === 0)) {
    feed.push({
      id: `nobeds-${hospital.name}`,
      at: new Date().toISOString(),
      tone: 'info',
      message: `${hospital.name} reports 0 free beds and is excluded from hospital matching.`,
    });
  }

  return feed
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
}

export async function buildHospitalDashboard(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { hospitalId },
    include: {
      bloodStock: { orderBy: { bloodGroup: 'asc' } },
      medicineStock: { orderBy: { medicine: 'asc' } },
    },
  });
  if (!hospital) return null;

  const assignments = await prisma.assignment.findMany({
    where: { hospitalId, closedAt: null },
    orderBy: { assignedAt: 'desc' },
    include: {
      ambulance: true,
      request: { include: { patient: true } },
    },
  });

  return {
    role: 'HOSPITAL' as const,
    dataSource: 'postgresql' as const,
    generatedAt: new Date().toISOString(),
    hospital: {
      hospitalId: hospital.hospitalId,
      name: hospital.name,
      area: areaLabel(hospital.lat, hospital.lon),
      lat: hospital.lat,
      lon: hospital.lon,
      totalBeds: hospital.totalBeds,
      freeBeds: hospital.freeBeds,
    },
    bloodStock: hospital.bloodStock.map((stock) => ({
      group: stock.bloodGroup as BloodGroup,
      units: stock.units,
      minimum: BLOOD_MINIMUM[stock.bloodGroup as BloodGroup] ?? 0,
    })),
    medicineStock: hospital.medicineStock.map((stock) => ({
      medicine: stock.medicine,
      units: stock.units,
      minimum: MEDICINE_MINIMUM[stock.medicine] ?? 10,
    })),
    incoming: assignments.map((row) => {
      const distanceKm = Number(row.distanceKm);
      return {
        requestId: row.requestId,
        patientName: row.request.patient.name,
        patientAge: row.request.patient.age,
        severity: row.request.severity,
        bloodGroupNeeded: row.request.bloodGroupNeeded as BloodGroup | null,
        medicineNeeded: row.request.medicineNeeded,
        ambulanceRegNo: row.ambulance.regNo,
        ambulanceDistanceKm: distanceKm,
        etaMinutes: etaMinutes(distanceKm),
        assignedAt: row.assignedAt.toISOString(),
        readinessScore: row.readinessScore,
        partialFlag: row.partialFlag,
      };
    }),
  };
}

/** Stock minimums used for the low-stock warning in the hospital inventory. */
const BLOOD_MINIMUM: Record<BloodGroup, number> = {
  'O+': 10,
  'O-': 3,
  'A+': 8,
  'A-': 3,
  'B+': 8,
  'B-': 3,
  'AB+': 3,
  'AB-': 2,
};

const MEDICINE_MINIMUM: Record<string, number> = {
  Adrenaline: 15,
  Atropine: 20,
  Insulin: 12,
  'Tetanus Toxoid': 15,
  Oxytocin: 10,
  Hydrocortisone: 8,
};
