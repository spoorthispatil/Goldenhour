import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

const dispatcher = request.agent(app);
const hospitalA = request.agent(app);
const hospitalB = request.agent(app);
const patientA = request.agent(app);
const patientB = request.agent(app);

const PASSWORD = 'HospitalPass123';
let hospitalAId = '';
let hospitalBId = '';
let ambulanceId = '';
let patientAId = '';
let patientBId = '';

async function createEmergency(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await dispatcher
    .post('/api/emergency-requests')
    .send({
      patientName: 'Test Patient',
      patientAge: 45,
      contact: '9845000123',
      lat: 15.3647,
      lon: 75.124,
      severity: 'HIGH',
      bloodGroupNeeded: 'O+',
      medicineNeeded: 'Adrenaline',
      ...overrides,
    })
    .expect(201);
  return response.body.request.requestId as string;
}

beforeAll(async () => {
  // The database starts empty; create everything through the public API.
  const alpha = await request(app).post('/api/auth/register/hospital').send({
    hospitalName: 'Alpha General Hospital',
    lat: 15.3647,
    lon: 75.124,
    totalBeds: 100,
    username: 'alpha.staff',
    password: PASSWORD,
  });
  expect(alpha.status).toBe(201);
  hospitalAId = alpha.body.user.hospitalId;

  const beta = await request(app).post('/api/auth/register/hospital').send({
    hospitalName: 'Beta Care Hospital',
    lat: 15.45,
    lon: 75.2,
    totalBeds: 50,
    username: 'beta.staff',
    password: PASSWORD,
  });
  expect(beta.status).toBe(201);
  hospitalBId = beta.body.user.hospitalId;

  await request(app).post('/api/auth/register/dispatcher').send({
    username: 'dispatch.test',
    password: PASSWORD,
  }).expect(201);

  await dispatcher.post('/api/auth/login').send({
    username: 'dispatch.test',
    password: PASSWORD,
  }).expect(200);
  await hospitalA.post('/api/auth/login').send({
    username: 'alpha.staff',
    password: PASSWORD,
  }).expect(200);
  await hospitalB.post('/api/auth/login').send({
    username: 'beta.staff',
    password: PASSWORD,
  }).expect(200);

  await hospitalA.post('/api/hospital/resources/import').send({
    totalBeds: 100,
    freeBeds: 10,
    bloodStock: [
      { group: 'O+', units: 5 },
      { group: 'B-', units: 0 },
    ],
    medicineStock: [
      { medicine: 'Adrenaline', units: 10 },
      { medicine: 'Tetanus Toxoid', units: 0 },
    ],
  }).expect(201);

  // Beta has no free beds, so matching must exclude it.
  await hospitalB.post('/api/hospital/resources/import').send({
    totalBeds: 50,
    freeBeds: 0,
    bloodStock: [{ group: 'O+', units: 1 }],
    medicineStock: [{ medicine: 'Adrenaline', units: 5 }],
  }).expect(201);

  const ambulance = await dispatcher.post('/api/ambulances').send({
    regNo: 'KA-25-AB-1234',
    lat: 15.3647,
    lon: 75.124,
  }).expect(201);
  ambulanceId = ambulance.body.ambulance.ambulanceId;

  const firstPatient = await request(app).post('/api/auth/register/patient').send({
    name: 'Asha Patil',
    age: 34,
    contact: '9845000111',
    username: 'asha.patient',
    password: PASSWORD,
  });
  expect(firstPatient.status).toBe(201);
  patientAId = firstPatient.body.user.patientId;

  const secondPatient = await request(app).post('/api/auth/register/patient').send({
    name: 'Ravi Kumar',
    age: 51,
    contact: '9845000222',
    username: 'ravi.patient',
    password: PASSWORD,
  });
  expect(secondPatient.status).toBe(201);
  patientBId = secondPatient.body.user.patientId;

  await patientA.post('/api/auth/login').send({
    username: 'asha.patient',
    password: PASSWORD,
  }).expect(200);
  await patientB.post('/api/auth/login').send({
    username: 'ravi.patient',
    password: PASSWORD,
  }).expect(200);
});

describe('self-registration', () => {
  it('creates a hospital with no free beds and a working login', async () => {
    const me = await hospitalA.get('/api/auth/me').expect(200);
    expect(me.body.user.role).toBe('HOSPITAL');
    expect(me.body.user.hospitalId).toBe(hospitalAId);
  });

  it('rejects a duplicate username, a short password and missing beds', async () => {
    const duplicate = await request(app).post('/api/auth/register/hospital').send({
      hospitalName: 'Duplicate Hospital',
      lat: 15.36,
      lon: 75.12,
      totalBeds: 10,
      username: 'alpha.staff',
      password: PASSWORD,
    });
    expect(duplicate.status).toBe(409);

    await request(app).post('/api/auth/register/dispatcher').send({
      username: 'new.dispatcher',
      password: 'short',
    }).expect(400);

    await request(app).post('/api/auth/register/hospital').send({
      hospitalName: 'No Beds Hospital',
      lat: 15.36,
      lon: 75.12,
      totalBeds: 0,
      username: 'nobeds.staff',
      password: PASSWORD,
    }).expect(400);
  });

  it('keeps role guards in both directions', async () => {
    await request(app).get('/api/queue').expect(401);
    await hospitalA.get('/api/queue').expect(403);
    await dispatcher.get('/api/hospital/resources').expect(403);
  });

  it('serves the public summary with the registered hospitals', async () => {
    const response = await request(app).get('/api/public/summary').expect(200);
    expect(response.body.stats.hospitals).toBe(2);
  });
});

describe('dataset import and individual stock', () => {
  it('imports the hospital dataset and returns it', async () => {
    const response = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(response.body.hospital.hospitalId).toBe(hospitalAId);
    expect(response.body.hospital.totalBeds).toBe(100);
    expect(response.body.hospital.freeBeds).toBe(10);
    expect(
      response.body.hospital.bloodStock.find(
        (row: { group: string }) => row.group === 'O+',
      ).units,
    ).toBe(5);
    expect(response.body.hospital.medicineStock).toHaveLength(2);
  });

  it('isolates hospitals from each other', async () => {
    const beta = await hospitalB.get('/api/hospital/resources').expect(200);
    expect(beta.body.hospital.hospitalId).toBe(hospitalBId);
    expect(beta.body.hospital.freeBeds).toBe(0);
    expect(beta.body.hospital.medicineStock).toHaveLength(1);
  });

  it('rejects an invalid dataset atomically', async () => {
    const invalid = await hospitalA.post('/api/hospital/resources/import').send({
      totalBeds: 100,
      freeBeds: 200,
      bloodStock: [{ group: 'Z+', units: 1 }],
      medicineStock: [],
    });
    expect(invalid.status).toBe(400);

    const stillIntact = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(stillIntact.body.hospital.freeBeds).toBe(10);
  });

  it('adds a new medicine and a new blood group individually', async () => {
    await hospitalA.patch('/api/hospital/resources').send({
      medicineStock: [{ medicine: 'Morphine', units: 20 }],
    }).expect(200);
    await hospitalA.patch('/api/hospital/resources').send({
      bloodStock: [{ group: 'A-', units: 3 }],
    }).expect(200);

    const response = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(
      response.body.hospital.medicineStock.find(
        (row: { medicine: string }) => row.medicine === 'Morphine',
      ).units,
    ).toBe(20);
    expect(
      response.body.hospital.bloodStock.find(
        (row: { group: string }) => row.group === 'A-',
      ).units,
    ).toBe(3);
  });

  it('rejects out-of-range individual values and over-capacity beds', async () => {
    await hospitalA.patch('/api/hospital/resources').send({ freeBeds: 999 }).expect(400);
    await hospitalA.patch('/api/hospital/resources').send({ freeBeds: -1 }).expect(400);
    await hospitalA.patch('/api/hospital/resources').send({}).expect(400);
  });
});

describe('fleet registration', () => {
  it('lists the fleet and refuses a duplicate registration number', async () => {
    const fleet = await dispatcher.get('/api/ambulances').expect(200);
    expect(fleet.body.count).toBe(1);

    const duplicate = await dispatcher.post('/api/ambulances').send({
      regNo: 'KA-25-AB-1234',
      lat: 15.36,
      lon: 75.12,
    });
    expect(duplicate.status).toBe(409);
  });

  it('validates coordinates and registration numbers', async () => {
    await dispatcher.post('/api/ambulances').send({
      regNo: 'X',
      lat: 200,
      lon: 75,
    }).expect(400);
  });
});

describe('patient portal access', () => {
  it('signs a patient in with a linked patient record', async () => {
    const me = await patientA.get('/api/auth/me').expect(200);
    expect(me.body.user.role).toBe('PATIENT');
    expect(me.body.user.patientId).toBe(patientAId);

    const overview = await patientA.get('/api/patient/overview').expect(200);
    expect(overview.body.profile.patientId).toBe(patientAId);
  });

  it('keeps patient, hospital and dispatcher areas apart', async () => {
    await patientA.get('/api/queue').expect(403);
    await hospitalA.get('/api/patient/overview').expect(403);
    await dispatcher.get('/api/patient/overview').expect(403);
  });

  it('validates patient registration fields', async () => {
    await request(app).post('/api/auth/register/patient').send({
      name: 'A',
      age: 200,
      contact: '123',
      username: 'bad.patient',
      password: 'short',
    }).expect(400);
  });
});

describe('hospital pre-booking', () => {
  /** A one-hour slot a few days ahead, on the hour. */
  const slot = (daysAhead: number, hour: number) => {
    const start = new Date();
    start.setDate(start.getDate() + daysAhead);
    start.setHours(hour, 0, 0, 0);
    return start.toISOString();
  };

  it('creates a pending request with a slot and refuses duplicates', async () => {
    const created = await patientA.post('/api/patient/prebookings').send({
      hospitalId: hospitalAId,
      reason: 'Planned observation',
      slotStart: slot(1, 10),
    }).expect(201);
    expect(created.body.prebooking.status).toBe('PENDING');
    expect(created.body.prebooking.slotStart).toBe(slot(1, 10));

    // A slot is required, and it must sit on the hour in the future.
    await patientA.post('/api/patient/prebookings').send({
      hospitalId: hospitalAId,
      reason: 'No slot',
    }).expect(400);
    await patientA.post('/api/patient/prebookings').send({
      hospitalId: hospitalAId,
      reason: 'Past slot',
      slotStart: new Date(Date.now() - 86_400_000).toISOString(),
    }).expect(400);

    await patientA.post('/api/patient/prebookings').send({
      hospitalId: hospitalAId,
      reason: 'Again',
      slotStart: slot(1, 11),
    }).expect(409);

    const list = await patientA.get('/api/patient/prebookings').expect(200);
    expect(list.body.count).toBe(1);
  });

  it('reserves a bed, admits, discharges and releases the bed', async () => {
    const before = await hospitalA.get('/api/hospital/resources').expect(200);
    const freeBefore = before.body.hospital.freeBeds as number;

    const hospitalList = await hospitalA.get('/api/hospital/prebookings').expect(200);
    const prebooking = hospitalList.body.prebookings.find(
      (row: { patient?: { patientId: string } }) =>
        row.patient?.patientId === patientAId,
    );
    expect(prebooking).toBeTruthy();

    // Another patient cannot cancel it.
    await patientB
      .patch(`/api/patient/prebookings/${prebooking.prebookingId}/cancel`)
      .expect(404);

    const confirmed = await hospitalA
      .patch(`/api/hospital/prebookings/${prebooking.prebookingId}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    expect(confirmed.body.prebooking.status).toBe('CONFIRMED');

    const afterConfirm = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(afterConfirm.body.hospital.freeBeds).toBe(freeBefore - 1);

    const admitted = await hospitalA
      .patch(`/api/hospital/prebookings/${prebooking.prebookingId}`)
      .send({ action: 'ADMIT' })
      .expect(200);
    expect(admitted.body.prebooking.status).toBe('ADMITTED');
    expect(admitted.body.prebooking.admittedAt).toBeTruthy();

    const afterAdmit = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(afterAdmit.body.hospital.freeBeds).toBe(freeBefore - 1);

    const discharged = await hospitalA
      .patch(`/api/hospital/prebookings/${prebooking.prebookingId}`)
      .send({ action: 'DISCHARGE' })
      .expect(200);
    expect(discharged.body.prebooking.status).toBe('DISCHARGED');
    expect(discharged.body.prebooking.dischargedAt).toBeTruthy();

    const afterDischarge = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(afterDischarge.body.hospital.freeBeds).toBe(freeBefore);

    // A discharged booking no longer blocks a new request.
    await patientA.post('/api/patient/prebookings').send({
      hospitalId: hospitalAId,
      reason: 'Second visit',
      slotStart: slot(2, 11),
    }).expect(201);
  });

  it('turns a confirmed cancellation into a request the hospital approves', async () => {
    const before = await hospitalA.get('/api/hospital/resources').expect(200);
    const freeBefore = before.body.hospital.freeBeds as number;

    const hospitalList = await hospitalA.get('/api/hospital/prebookings').expect(200);
    const prebooking = hospitalList.body.prebookings.find(
      (row: { status: string; patient?: { patientId: string } }) =>
        row.status === 'PENDING' && row.patient?.patientId === patientAId,
    );
    expect(prebooking).toBeTruthy();

    await hospitalA
      .patch(`/api/hospital/prebookings/${prebooking.prebookingId}`)
      .send({ action: 'CONFIRM' })
      .expect(200);

    const requested = await patientA
      .patch(`/api/patient/prebookings/${prebooking.prebookingId}/cancel`)
      .send({ reason: 'Treated elsewhere' })
      .expect(200);
    expect(requested.body.prebooking.status).toBe('CANCEL_REQUESTED');
    expect(requested.body.prebooking.cancellationReason).toBe('Treated elsewhere');

    // The bed stays reserved while the request waits for the hospital.
    const duringRequest = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(duringRequest.body.hospital.freeBeds).toBe(freeBefore - 1);

    const approved = await hospitalA
      .patch(`/api/hospital/prebookings/${prebooking.prebookingId}`)
      .send({ action: 'APPROVE_CANCELLATION' })
      .expect(200);
    expect(approved.body.prebooking.status).toBe('CANCELLED');

    const afterApproval = await hospitalA.get('/api/hospital/resources').expect(200);
    expect(afterApproval.body.hospital.freeBeds).toBe(freeBefore);
  });

  it('rejects a pre-booking at a hospital with no free beds', async () => {
    await patientB.post('/api/patient/prebookings').send({
      hospitalId: hospitalBId,
      reason: 'No capacity',
      slotStart: slot(3, 12),
    }).expect(409);
  });
});

describe('donation campaigns', () => {
  let campaignId = '';

  it('lets a hospital publish a blood donation camp', async () => {
    const response = await hospitalA.post('/api/hospital/campaigns').send({
      type: 'BLOOD_DONATION',
      title: 'Campus blood donation camp',
      description: 'Open to all healthy donors above 18 years.',
      location: 'Hospital auditorium',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    }).expect(201);
    campaignId = response.body.campaign.campaignId;
    expect(response.body.campaign.type).toBe('BLOOD_DONATION');
  });

  it('notifies patients and tracks read receipts per patient', async () => {
    const first = await patientA.get('/api/patient/campaigns').expect(200);
    expect(first.body.unread).toBe(1);
    expect(first.body.campaigns[0].read).toBe(false);

    await patientA.post(`/api/patient/campaigns/${campaignId}/read`).expect(200);
    const afterRead = await patientA.get('/api/patient/campaigns').expect(200);
    expect(afterRead.body.unread).toBe(0);

    const secondPatient = await patientB.get('/api/patient/campaigns').expect(200);
    expect(secondPatient.body.unread).toBe(1);

    await patientB.post('/api/patient/campaigns/read-all').expect(200);
    const afterAll = await patientB.get('/api/patient/campaigns').expect(200);
    expect(afterAll.body.unread).toBe(0);
  });

  it('validates campaign dates and types', async () => {
    await hospitalA.post('/api/hospital/campaigns').send({
      type: 'BLOOD_DONATION',
      title: 'Bad date camp',
      description: 'This camp is far outside the allowed window.',
      location: 'Somewhere',
      startsAt: '2035-01-01T00:00:00.000Z',
    }).expect(400);
  });
});

describe('ranking and matching', () => {
  it('starts from an empty queue', async () => {
    const response = await dispatcher.get('/api/queue').expect(200);
    expect(response.body.stats.queued).toBe(0);
  });

  it('ranks a critical call above an older high call', async () => {
    const highId = await createEmergency({ severity: 'HIGH' });
    const criticalId = await createEmergency({ severity: 'CRITICAL' });

    const queue = await dispatcher.get('/api/queue').expect(200);
    expect(queue.body.items[0].requestId).toBe(criticalId);
    expect(queue.body.items[1].requestId).toBe(highId);
  });

  it('scores the stocked hospital 100 and excludes the zero-bed hospital', async () => {
    const requestId = await createEmergency();
    const response = await dispatcher
      .get('/api/hospitals/match')
      .query({ requestId })
      .expect(200);

    const alpha = response.body.hospitals.find(
      (row: { hospitalId: string }) => row.hospitalId === hospitalAId,
    );
    expect(alpha.score).toBe(100);
    expect(alpha.partialFlag).toBe(false);
    expect(
      response.body.excludedHospitals.some(
        (row: { hospitalId: string }) => row.hospitalId === hospitalBId,
      ),
    ).toBe(true);
  });

  it('reacts to blood stock and restores it', async () => {
    const requestId = await createEmergency();
    await hospitalA.patch('/api/hospital/resources').send({
      bloodStock: [{ group: 'O+', units: 0 }],
    }).expect(200);

    const after = await dispatcher
      .get('/api/hospitals/match')
      .query({ requestId })
      .expect(200);
    const row = after.body.hospitals.find(
      (item: { hospitalId: string }) => item.hospitalId === hospitalAId,
    );
    expect(row.score).toBe(60);
    expect(row.partialFlag).toBe(true);

    await hospitalA.patch('/api/hospital/resources').send({
      bloodStock: [{ group: 'O+', units: 5 }],
    }).expect(200);
  });

  it('validates and 404s unknown match requests', async () => {
    await dispatcher.get('/api/hospitals/match').expect(400);
    await dispatcher
      .get('/api/hospitals/match')
      .query({ requestId: 'REQ-2026-9999' })
      .expect(404);
  });
});

describe('assignment and closure', () => {
  it('reserves a bed and releases it on closure', async () => {
    const requestId = await createEmergency();
    const ambulances = await dispatcher
      .get('/api/ambulances/search')
      .query({ requestId })
      .expect(200);
    expect(ambulances.body.ambulances[0].ambulanceId).toBe(ambulanceId);

    const matches = await dispatcher
      .get('/api/hospitals/match')
      .query({ requestId })
      .expect(200);
    const target = matches.body.hospitals[0];
    const before = target.freeBeds;

    const assigned = await dispatcher.post('/api/assignments').send({
      requestId,
      ambulanceId,
      hospitalId: target.hospitalId,
    }).expect(201);
    const assignmentId = assigned.body.assignment.assignmentId as string;
    expect(assigned.body.assignment.hospital.remainingFreeBeds).toBe(before - 1);

    const closed = await dispatcher
      .post(`/api/assignments/${assignmentId}/close`)
      .expect(200);
    expect(closed.body.assignment.requestStatus).toBe('CLOSED');
    expect(closed.body.assignment.ambulance.status).toBe('AVAILABLE');
    expect(closed.body.assignment.hospital.freeBeds).toBe(before);

    const history = await dispatcher.get('/api/assignments').query({ limit: 50 }).expect(200);
    const stored = history.body.assignments.find(
      (row: { assignmentId: string }) => row.assignmentId === assignmentId,
    );
    expect(stored.closedAt).not.toBeNull();

    await dispatcher.post(`/api/assignments/${assignmentId}/close`).expect(409);
  });

  it('validates intake on the server', async () => {
    const response = await dispatcher.post('/api/emergency-requests').send({
      patientName: 'Invalid Contact',
      patientAge: 50,
      contact: '12345',
      lat: 15.36,
      lon: 75.12,
      severity: 'HIGH',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('patient-raised ambulance call', () => {
  it('creates a queued call tied to the signed-in patient', async () => {
    const response = await patientA.post('/api/patient/requests').send({
      lat: 15.3647,
      lon: 75.124,
      severity: 'CRITICAL',
      bloodGroupNeeded: 'O+',
      medicineNeeded: 'Adrenaline',
    }).expect(201);

    expect(response.body.request.patient.patientId).toBe(patientAId);
    expect(response.body.request.status).toBe('QUEUED');
    const requestId = response.body.request.requestId as string;

    const mine = await patientA.get('/api/patient/requests').expect(200);
    expect(mine.body.requests[0].requestId).toBe(requestId);

    const others = await patientB.get('/api/patient/requests').expect(200);
    expect(
      others.body.requests.some((row: { requestId: string }) => row.requestId === requestId),
    ).toBe(false);

    const queue = await dispatcher.get('/api/queue').expect(200);
    expect(
      queue.body.items.some((row: { requestId: string }) => row.requestId === requestId),
    ).toBe(true);
  });

  it('takes identity from the account, not the body', async () => {
    const response = await patientB.post('/api/patient/requests').send({
      lat: 15.36,
      lon: 75.12,
      severity: 'LOW',
      patientName: 'Someone Else',
      contact: '0000000000',
    }).expect(201);
    expect(response.body.request.patient.patientId).toBe(patientBId);
    expect(response.body.request.patient.name).toBe('Ravi Kumar');
  });
});
