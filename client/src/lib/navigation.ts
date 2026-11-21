import {
  Activity,
  Ambulance,
  BedDouble,
  BellRing,
  Building2,
  CalendarCheck,
  FileUp,
  ClipboardList,
  Gauge,
  Megaphone,
  PlusCircle,
  Siren,
  SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const DISPATCHER_NAV: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Command dashboard', to: '/dispatcher', icon: Gauge },
      { label: 'Register emergency', to: '/dispatcher/emergency/new', icon: PlusCircle },
      { label: 'Priority queue', to: '/dispatcher/queue', icon: Siren },
      { label: 'Ambulance search', to: '/dispatcher/ambulances', icon: Ambulance },
      { label: 'Ambulance fleet', to: '/dispatcher/fleet', icon: Ambulance },
    ],
  },
  {
    title: 'Matching',
    items: [
      { label: 'Hospital matching', to: '/dispatcher/hospitals', icon: Building2 },
      { label: 'Assignment desk', to: '/dispatcher/assignments', icon: ClipboardList },
    ],
  },
];

export const HOSPITAL_NAV: NavSection[] = [
  {
    title: 'Hospital',
    items: [
      { label: 'Hospital dashboard', to: '/hospital', icon: Activity },
      { label: 'Incoming patients', to: '/hospital', icon: BedDouble },
      { label: 'Beds & resources', to: '/hospital/resources', icon: SlidersHorizontal },
      { label: 'Import dataset', to: '/hospital/import', icon: FileUp },
    ],
  },
  {
    title: 'Patient services',
    items: [
      { label: 'Pre-bookings', to: '/hospital/prebookings', icon: CalendarCheck },
      { label: 'Donation campaigns', to: '/hospital/campaigns', icon: Megaphone },
    ],
  },
];

export const PATIENT_NAV: NavSection[] = [
  {
    title: 'Patient portal',
    items: [
      { label: 'My dashboard', to: '/patient', icon: Gauge },
      { label: 'Call an ambulance', to: '/patient/ambulance', icon: Siren },
      { label: 'Hospitals', to: '/patient/hospitals', icon: Building2 },
      { label: 'Notifications', to: '/patient/notifications', icon: BellRing },
    ],
  },
];
