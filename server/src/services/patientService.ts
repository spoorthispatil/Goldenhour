import { RequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { PatientEmergencyInput } from '../validation/patient';
import { countUnreadCampaigns, listPatientCampaigns } from './campaignService';
import { createEmergencyRequest } from './emergencyService';
import { listPatientPrebookings, PortalError } from './prebookingService';

export async function listPatientHospitals() {
  const rows = await prisma.hospital.findMany({
    orderBy: [{ freeBeds: 'desc' }, { name: 'asc' }],
    include: {
      bloodStock: { orderBy: { bloodGroup: 'asc' } },
      medicineStock: { orderBy: { medicine: 'asc' } },
    },
  });

  return rows.map((row) => ({
    hospitalId: row.hospitalId,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    totalBeds: row.totalBeds,
    freeBeds: row.freeBeds,
    accepting: row.freeBeds > 0,
    bloodStock: row.bloodStock.map((stock) => ({
      group: stock.bloodGroup,
      units: stock.units,
    })),
    medicineStock: row.medicineStock.map((stock) => ({
      medicine: stock.medicine,
      units: stock.units,
    })),
  }));
}

export async function listPatientRequests(patientId: string) {
  const rows = await prisma.emergencyRequest.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      assignment: {
        include: {
          hospital: { select: { name: true } },
          ambulance: { select: { regNo: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    requestId: row.requestId,
    status: row.status,
    severity: row.severity,
    createdAt: row.createdAt.toISOString(),
    bloodGroupNeeded: row.bloodGroupNeeded,
    medicineNeeded: row.medicineNeeded,
    lat: row.lat,
    lon: row.lon,
    hospitalName: row.assignment?.hospital.name ?? null,
    ambulanceRegNo: row.assignment?.ambulance.regNo ?? null,
    assignmentId: row.assignment?.assignmentId ?? null,
  }));
}

export async function createPatientRequest(
  userId: string,
  patientId: string,
  input: PatientEmergencyInput,
) {
  const patient = await prisma.patient.findUnique({
    where: { patientId },
    select: { name: true, age: true, contact: true },
  });
  if (!patient) {
    throw new PortalError('PATIENT_NOT_FOUND', 404, 'This patient record no longer exists.');
  }

  const created = await createEmergencyRequest(
    {
      patientName: patient.name,
      patientAge: patient.age,
      contact: patient.contact,
      lat: input.lat,
      lon: input.lon,
      severity: input.severity,
      bloodGroupNeeded: input.bloodGroupNeeded,
      medicineNeeded: input.medicineNeeded,
    },
    userId,
    patientId,
  );

  return {
    ...created,
    message:
      created.queuePosition === null
        ? `Emergency ${created.requestId} is queued. A dispatcher will assign an ambulance.`
        : `Emergency ${created.requestId} is queued at position ${created.queuePosition}.`,
  };
}

export async function buildPatientOverview(userId: string, patientId: string) {
  const [patient, requests, prebookings, campaigns, unreadCampaigns, hospitals] =
    await Promise.all([
      prisma.patient.findUnique({
        where: { patientId },
        select: { patientId: true, name: true, age: true, contact: true },
      }),
      listPatientRequests(patientId),
      listPatientPrebookings(patientId),
      listPatientCampaigns(patientId),
      countUnreadCampaigns(patientId),
      prisma.hospital.count(),
    ]);

  if (!patient) {
    throw new PortalError('PATIENT_NOT_FOUND', 404, 'This patient record no longer exists.');
  }

  return {
    profile: {
      ...patient,
      username: null,
      userId,
    },
    stats: {
      activeRequests: requests.filter((row) => row.status !== RequestStatus.CLOSED).length,
      upcomingPrebookings: prebookings.filter(
        (row) =>
          row.status === 'PENDING' ||
          row.status === 'CONFIRMED' ||
          row.status === 'CANCEL_REQUESTED' ||
          row.status === 'ADMITTED',
      ).length,
      unreadCampaigns,
      hospitals,
    },
    recentRequests: requests.slice(0, 5),
    prebookings: prebookings.slice(0, 5),
    campaigns: campaigns.slice(0, 4),
  };
}
