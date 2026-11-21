import { describe, expect, it } from 'vitest';
import { validateAmbulanceSearch } from '../src/validation/ambulanceSearch';
import { validateAssignment } from '../src/validation/assignment';
import { validateEmergencyRequest } from '../src/validation/emergency';
import { validateHospitalMatch } from '../src/validation/hospitalMatch';
import { validateHospitalResources } from '../src/validation/hospitalResources';
import { normaliseRequestId } from '../src/validation/requestId';

const emergency = {
  patientName: 'Asha Patil',
  patientAge: 34,
  contact: '9845012345',
  lat: 15.3647,
  lon: 75.124,
  severity: 'HIGH',
  bloodGroupNeeded: 'O+',
  medicineNeeded: 'Adrenaline',
};

describe('request IDs', () => {
  it('uppercases and validates REQ-YYYY-NNNN', () => {
    expect(normaliseRequestId(' req-2026-0001 ')).toBe('REQ-2026-0001');
    expect(normaliseRequestId('REQ-26-1')).toBeNull();
    expect(normaliseRequestId(42)).toBeNull();
  });
});

describe('emergency intake validation', () => {
  it('accepts a valid body and normalises text', () => {
    const result = validateEmergencyRequest({
      ...emergency,
      patientName: '  Asha Patil  ',
      severity: 'high',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.patientName).toBe('Asha Patil');
      expect(result.value.severity).toBe('HIGH');
      expect(result.value.medicineNeeded).toBe('Adrenaline');
    }
  });

  it('rejects a one-character name, bad age, 9-digit contact and out-of-range coordinates', () => {
    const result = validateEmergencyRequest({
      ...emergency,
      patientName: 'A',
      patientAge: 121,
      contact: '984501234',
      lat: 91,
      lon: -181,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.errors.map((error) => error.field);
      expect(fields).toEqual(
        expect.arrayContaining(['patientName', 'patientAge', 'contact', 'lat', 'lon']),
      );
    }
  });

  it('rejects an unknown severity and blood group', () => {
    const result = validateEmergencyRequest({
      ...emergency,
      severity: 'URGENT',
      bloodGroupNeeded: 'Z+',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining(['severity', 'bloodGroupNeeded']),
      );
    }
  });
});

describe('ambulance search validation', () => {
  it('accepts a request anchor with a limit', () => {
    const result = validateAmbulanceSearch({ requestId: 'req-2026-0001', limit: '10' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requestId).toBe('REQ-2026-0001');
      expect(result.value.limit).toBe(10);
    }
  });

  it('accepts exactly one coordinate anchor', () => {
    const result = validateAmbulanceSearch({ lat: '15.36', lon: '75.12' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lat).toBe(15.36);
      expect(result.value.lon).toBe(75.12);
    }
  });

  it('rejects a request and coordinates together, or neither', () => {
    expect(validateAmbulanceSearch({ requestId: 'REQ-2026-0001', lat: '15', lon: '75' }).ok).toBe(false);
    expect(validateAmbulanceSearch({}).ok).toBe(false);
  });

  it('rejects a limit outside 1-20', () => {
    expect(validateAmbulanceSearch({ requestId: 'REQ-2026-0001', limit: '21' }).ok).toBe(false);
    expect(validateAmbulanceSearch({ requestId: 'REQ-2026-0001', limit: '0' }).ok).toBe(false);
    expect(validateAmbulanceSearch({ requestId: 'REQ-2026-0001', limit: '2.5' }).ok).toBe(false);
  });
});

describe('hospital match validation', () => {
  it('requires a well-formed request ID', () => {
    expect(validateHospitalMatch({ requestId: 'REQ-2026-0001' }).ok).toBe(true);
    expect(validateHospitalMatch({}).ok).toBe(false);
    expect(validateHospitalMatch({ requestId: 'ABC' }).ok).toBe(false);
  });
});

describe('assignment validation', () => {
  it('accepts the three required ids and uppercases the request id', () => {
    const result = validateAssignment({
      requestId: 'req-2026-0001',
      ambulanceId: 'AMB-04',
      hospitalId: 'HOSP-03',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.requestId).toBe('REQ-2026-0001');
  });

  it('rejects missing ids', () => {
    const result = validateAssignment({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.field)).toEqual([
      'requestId',
      'ambulanceId',
      'hospitalId',
    ]);
  });
});

describe('hospital resources validation', () => {
  it('accepts a partial body', () => {
    const result = validateHospitalResources({
      bloodStock: [{ group: 'o+', units: 6 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.bloodStock).toEqual([{ group: 'O+', units: 6 }]);
  });

  it('rejects an empty body', () => {
    expect(validateHospitalResources({}).ok).toBe(false);
  });

  it('rejects negative or fractional free beds', () => {
    expect(validateHospitalResources({ freeBeds: -1 }).ok).toBe(false);
    expect(validateHospitalResources({ freeBeds: 12.5 }).ok).toBe(false);
  });

  it('rejects units outside 0-9999 and duplicate groups', () => {
    expect(validateHospitalResources({ bloodStock: [{ group: 'O+', units: 10_000 }] }).ok).toBe(false);
    expect(
      validateHospitalResources({
        bloodStock: [
          { group: 'O+', units: 1 },
          { group: 'O+', units: 2 },
        ],
      }).ok,
    ).toBe(false);
  });

  it('rejects duplicate medicine names regardless of case', () => {
    expect(
      validateHospitalResources({
        medicineStock: [
          { medicine: 'Adrenaline', units: 1 },
          { medicine: 'adrenaline', units: 2 },
        ],
      }).ok,
    ).toBe(false);
  });
});
