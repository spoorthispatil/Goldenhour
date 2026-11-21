import { RequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { SEVERITY_ORDER, SEVERITY_WEIGHT } from '../types';
import type { BloodGroup } from '../types';
import { areaLabel } from './dashboardService';
import {
  RANKING_ALGORITHM,
  rankRequests,
  waitingMinutesSince,
} from './priorityQueue';

/**
 * The dispatcher priority queue. Only QUEUED calls are ranked; calls
 * already ASSIGNED are listed separately so the rank of a waiting call is not
 * inflated by cases that already have an ambulance.
 */
export async function buildPriorityQueue(now = Date.now()) {
  const rows = await prisma.emergencyRequest.findMany({
    where: { status: { in: [RequestStatus.QUEUED, RequestStatus.ASSIGNED] } },
    include: { patient: true },
    orderBy: { createdAt: 'desc' },
  });

  const queuedRows = rows.filter((row) => row.status === RequestStatus.QUEUED);
  const assignedRows = rows.filter((row) => row.status === RequestStatus.ASSIGNED);

  const items = rankRequests(queuedRows, now).map(
    ({ item: row, rank, severityWeight, waitingMinutes, priorityScore }) => ({
      rank,
      requestId: row.requestId,
      severity: row.severity,
      severityWeight,
      waitingMinutes,
      priorityScore,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      patientName: row.patient.name,
      patientAge: row.patient.age,
      patientContact: row.patient.contact,
      bloodGroupNeeded: row.bloodGroupNeeded as BloodGroup | null,
      medicineNeeded: row.medicineNeeded,
      location: {
        lat: row.lat,
        lon: row.lon,
        label: areaLabel(row.lat, row.lon),
      },
    }),
  );

  const bySeverity = SEVERITY_ORDER.map((severity) => ({
    severity,
    weight: SEVERITY_WEIGHT[severity],
    count: queuedRows.filter((row) => row.severity === severity).length,
  }));

  const waits = items.map((item) => item.waitingMinutes);
  const longestWaitMinutes = waits.length > 0 ? Math.max(...waits) : 0;
  const averageWaitMinutes =
    waits.length > 0
      ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length)
      : 0;

  const next = items[0] ?? null;

  return {
    role: 'DISPATCHER' as const,
    dataSource: 'postgresql' as const,
    generatedAt: new Date(now).toISOString(),
    refreshIntervalSeconds: 5,
    algorithm: RANKING_ALGORITHM,
    stats: {
      queued: items.length,
      inProgress: assignedRows.length,
      criticalWaiting:
        bySeverity.find((entry) => entry.severity === 'CRITICAL')?.count ?? 0,
      longestWaitMinutes,
      averageWaitMinutes,
      bySeverity,
      nextUp: next
        ? {
            requestId: next.requestId,
            severity: next.severity,
            patientName: next.patientName,
            waitingMinutes: next.waitingMinutes,
            priorityScore: next.priorityScore,
          }
        : null,
    },
    items,
    inProgress: assignedRows.map((row) => ({
      requestId: row.requestId,
      severity: row.severity,
      patientName: row.patient.name,
      waitingMinutes: waitingMinutesSince(row.createdAt, now),
      createdAt: row.createdAt.toISOString(),
      area: areaLabel(row.lat, row.lon),
    })),
  };
}
