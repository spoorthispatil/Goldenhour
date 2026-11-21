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

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  serverTime: string;
  database: {
    configured: boolean;
    connected: boolean;
    latencyMs: number | null;
    message: string;
  };
}

export interface QueueItem {
  rank: number;
  requestId: string;
  patientName: string;
  patientAge: number;
  severity: Severity;
  severityWeight: number;
  priorityScore: number;
  status: RequestStatus;
  waitingMinutes: number;
  createdAt: string;
  location: { lat: number; lon: number; label: string };
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
}

export interface EmergencyRequestListItem {
  requestId: string;
  status: RequestStatus;
  severity: Severity;
  createdAt: string;
  waitingMinutes: number;
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
  location: { lat: number; lon: number; label: string };
  patient: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
  };
  assignmentId: string | null;
}

export interface NearbyAmbulance {
  ambulanceId: string;
  regNo: string;
  status: AmbulanceStatus;
  location: { lat: number; lon: number; label: string };
  distanceKm: number;
  etaMinutes: number;
  isNearest: boolean;
}

export interface AmbulanceSearchData {
  generatedAt: string;
  origin: { lat: number; lon: number; label: string };
  request: {
    requestId: string;
    patientName: string;
    patientAge: number;
    severity: Severity;
    status: RequestStatus;
    area: string;
    waitingMinutes: number;
    bloodGroupNeeded: BloodGroup | null;
    medicineNeeded: string | null;
  } | null;
  search: {
    method: 'haversine';
    speedKmh: number;
    limit: number;
    eligible: number;
    totalFleet: number;
    excluded: { BUSY: number; OFFLINE: number };
  };
  ambulances: NearbyAmbulance[];
}

export interface HospitalReadiness {
  rank: number;
  hospitalId: string;
  name: string;
  area: string;
  distanceKm: number;
  totalBeds: number;
  freeBeds: number;
  score: number;
  partialFlag: boolean;
  reason: string;
  components: {
    blood: {
      required: boolean;
      group: BloodGroup | null;
      units: number | null;
      points: number;
      max: number;
    };
    medicine: {
      required: boolean;
      medicine: string | null;
      units: number | null;
      points: number;
      max: number;
    };
    nearness: {
      distanceKm: number;
      radiusKm: number;
      points: number;
      max: number;
    };
  };
}

export interface HospitalMatchData {
  role: 'DISPATCHER';
  generatedAt: string;
  algorithm: {
    blood: number;
    medicine: number;
    nearness: number;
    nearnessFormula: string;
    radiusKm: number;
    rule: string;
  };
  request: {
    requestId: string;
    patientName: string;
    patientAge: number;
    severity: Severity;
    status: RequestStatus;
    area: string;
    waitingMinutes: number;
    bloodGroupNeeded: BloodGroup | null;
    medicineNeeded: string | null;
    location: { lat: number; lon: number; label: string };
  };
  stats: {
    eligible: number;
    excluded: number;
    bestScore: number | null;
  };
  hospitals: HospitalReadiness[];
  excludedHospitals: {
    hospitalId: string;
    name: string;
    area: string;
    distanceKm: number;
    freeBeds: number;
    reason: string;
  }[];
}

export interface HospitalResourcesResponse {
  status: 'updated';
  message?: string;
  hospital: {
    hospitalId: string;
    name: string;
    freeBeds: number;
    totalBeds: number;
    bloodStock: { group: BloodGroup; units: number }[];
    medicineStock: { medicine: string; units: number }[];
  };
  changes: {
    freeBeds: number | null;
    bloodStock: number;
    medicineStock: number;
  };
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
    severity: Severity;
  };
}

export interface ClosureResult {
  status: 'closed';
  assignmentId: string;
  requestId: string;
  closedAt: string;
  requestStatus: 'CLOSED';
  ambulance: { ambulanceId: string; regNo: string; status: AmbulanceStatus };
  hospital: {
    hospitalId: string;
    name: string;
    freeBeds: number;
    releasedBed: boolean;
  };
}

export interface AssignmentListItem {
  assignmentId: string;
  requestId: string;
  patientName: string;
  severity: Severity;
  ambulanceRegNo: string;
  hospitalName: string;
  distanceKm: number;
  readinessScore: number;
  partialFlag: boolean;
  reason: string;
  assignedAt: string;
  closedAt: string | null;
}

export interface RankingAlgorithm {
  name: string;
  formula: string;
  rule: string;
  weights: Record<Severity, number>;
  waitingCapMinutes: number;
  dominanceFactor: number;
  complexity: string;
}

export interface PriorityQueueItem {
  rank: number;
  requestId: string;
  severity: Severity;
  severityWeight: number;
  waitingMinutes: number;
  priorityScore: number;
  status: RequestStatus;
  createdAt: string;
  patientName: string;
  patientAge: number;
  patientContact: string;
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
  location: { lat: number; lon: number; label: string };
}

export interface PriorityQueueData {
  role: 'DISPATCHER';
  dataSource: 'postgresql';
  generatedAt: string;
  refreshIntervalSeconds: number;
  algorithm: RankingAlgorithm;
  stats: {
    queued: number;
    inProgress: number;
    criticalWaiting: number;
    longestWaitMinutes: number;
    averageWaitMinutes: number;
    bySeverity: { severity: Severity; weight: number; count: number }[];
    nextUp: {
      requestId: string;
      severity: Severity;
      patientName: string;
      waitingMinutes: number;
      priorityScore: number;
    } | null;
  };
  items: PriorityQueueItem[];
  inProgress: {
    requestId: string;
    severity: Severity;
    patientName: string;
    waitingMinutes: number;
    createdAt: string;
    area: string;
  }[];
}

export interface AmbulanceSummary {
  ambulanceId: string;
  regNo: string;
  status: AmbulanceStatus;
  location: { lat: number; lon: number; label: string };
  distanceKmToLatestRequest: number | null;
}

export interface HospitalSummary {
  hospitalId: string;
  name: string;
  area: string;
  totalBeds: number;
  freeBeds: number;
  bloodUnits: number;
  oPositiveUnits: number;
  adrenalineUnits: number;
  medicinesTracked: number;
}

export interface AssignmentSummary {
  assignmentId: string;
  requestId: string;
  patientName: string;
  severity: Severity;
  hospitalName: string;
  ambulanceRegNo: string;
  distanceKm: number;
  readinessScore: number;
  partialFlag: boolean;
  reason: string;
  assignedAt: string;
  closedAt: string | null;
}

export interface StatusFeedItem {
  id: string;
  at: string;
  tone: 'info' | 'critical' | 'success' | 'warning';
  message: string;
}

export interface DispatcherDashboardData {
  role: 'DISPATCHER';
  dataSource: 'postgresql';
  generatedAt: string;
  refreshIntervalSeconds: number;
  stats: {
    totalEmergencies: number;
    criticalEmergencies: number;
    pendingRequests: number;
    activeAssignments: number;
    availableAmbulances: number;
    busyAmbulances: number;
    offlineAmbulances: number;
    totalHospitals: number;
    freeBeds: number;
  };
  queue: QueueItem[];
  assignments: AssignmentSummary[];
  ambulances: AmbulanceSummary[];
  hospitals: HospitalSummary[];
  severityBreakdown: { severity: Severity; weight: number; count: number }[];
  volumeByHour: { label: string; emergencies: number }[];
  statusFeed: StatusFeedItem[];
}

export interface HospitalDashboardData {
  role: 'HOSPITAL';
  dataSource: 'postgresql';
  generatedAt: string;
  hospital: {
    hospitalId: string;
    name: string;
    area: string;
    lat: number;
    lon: number;
    totalBeds: number;
    freeBeds: number;
  };
  bloodStock: { group: BloodGroup; units: number; minimum: number }[];
  medicineStock: { medicine: string; units: number; minimum: number }[];
  incoming: {
    requestId: string;
    patientName: string;
    patientAge: number;
    severity: Severity;
    bloodGroupNeeded: BloodGroup | null;
    medicineNeeded: string | null;
    ambulanceRegNo: string;
    ambulanceDistanceKm: number;
    etaMinutes: number;
    assignedAt: string;
    readinessScore: number;
    partialFlag: boolean;
  }[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface CreatedEmergency {
  requestId: string;
  status: RequestStatus;
  severity: Severity;
  createdAt: string;
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
  location: { lat: number; lon: number; label: string };
  patient: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
  };
  queuePosition: number | null;
}

export interface PublicSummary {
  generatedAt: string;
  stats: {
    open: number;
    critical: number;
    hospitals: number;
    availableAmbulances: number;
  };
  queue: {
    requestId: string;
    severity: Severity;
    area: string;
    waitingMinutes: number;
  }[];
}

export interface DatabaseOverview {
  dataSource: 'postgresql';
  databaseName: string;
  serverVersion: string;
  sizePretty: string;
  tables: { name: string; label: string; rows: number }[];
  constraintCount: number;
  indexCount: number;
  migrationCount: number;
}

export type PrebookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'CANCEL_REQUESTED'
  | 'ADMITTED'
  | 'DISCHARGED';

export type CampaignType = 'BLOOD_DONATION' | 'ORGAN_DONATION';
export type CampaignAudience = 'ALL' | 'CITY' | 'BLOOD_GROUP';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';

export interface ChannelDeliverySummary {
  sent: number;
  skipped: number;
  failed: number;
}

export interface CampaignDeliverySummary {
  recipients: number;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  channels: Record<NotificationChannel, ChannelDeliverySummary>;
  skippedReasons: Record<string, number>;
  truncated: boolean;
}

export interface PatientDeliveryProfile {
  profile: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
    email: string | null;
    city: string | null;
    bloodGroup: BloodGroup | null;
    notifyEmail: boolean;
    notifySms: boolean;
    notifyPush: boolean;
  };
  pushDevices: {
    subscriptionId: string;
    endpointHost: string;
    createdAt: string;
  }[];
}

export interface CampaignDeliveryReport {
  campaign: {
    campaignId: string;
    audience: CampaignAudience;
    audienceValue: string | null;
    channels: NotificationChannel[];
  };
  summary: CampaignDeliverySummary;
  notifications: {
    notificationId: string;
    patientId: string;
    patientName: string;
    channel: NotificationChannel;
    status: 'SENT' | 'SKIPPED' | 'FAILED';
    destination: string | null;
    provider: string;
    detail: string | null;
    sentAt: string | null;
  }[];
  truncated: boolean;
}

export interface PatientHospital {
  hospitalId: string;
  name: string;
  lat: number;
  lon: number;
  totalBeds: number;
  freeBeds: number;
  accepting: boolean;
  bloodStock: { group: BloodGroup; units: number }[];
  medicineStock: { medicine: string; units: number }[];
}

export interface PatientPrebooking {
  prebookingId: string;
  reason: string;
  slotStart: string | null;
  slotEnd: string | null;
  status: PrebookingStatus;
  createdAt: string;
  decidedAt: string | null;
  admittedAt: string | null;
  dischargedAt: string | null;
  cancellationReason: string | null;
  hospital: {
    hospitalId: string;
    name: string;
    lat: number;
    lon: number;
    freeBeds: number;
    totalBeds: number;
  };
  patient?: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
  };
}

export interface PatientRequest {
  requestId: string;
  status: RequestStatus;
  severity: Severity;
  createdAt: string;
  bloodGroupNeeded: BloodGroup | null;
  medicineNeeded: string | null;
  lat: number;
  lon: number;
  hospitalName: string | null;
  ambulanceRegNo: string | null;
  assignmentId: string | null;
}

export interface DonationCampaign {
  campaignId: string;
  type: CampaignType;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  audience: CampaignAudience;
  audienceValue: string | null;
  channels: NotificationChannel[];
  createdAt: string;
  hospitalName: string | null;
  read: boolean;
  readAt: string | null;
}

export interface PatientOverview {
  profile: {
    patientId: string;
    name: string;
    age: number;
    contact: string;
  };
  stats: {
    activeRequests: number;
    upcomingPrebookings: number;
    unreadCampaigns: number;
    hospitals: number;
  };
  recentRequests: PatientRequest[];
  prebookings: PatientPrebooking[];
  campaigns: DonationCampaign[];
}
