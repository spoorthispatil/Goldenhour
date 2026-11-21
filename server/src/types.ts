export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RequestStatus = 'QUEUED' | 'ASSIGNED' | 'CLOSED';
export type AmbulanceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];
