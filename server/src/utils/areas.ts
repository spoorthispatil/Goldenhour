import { haversineKm } from './geo';

/**
 * Display helper: the schema stores coordinates, not place names,
 * so locations are labelled from the nearest known Hubballi area.
 * This does not affect any algorithm - distance is always computed from lat/lon.
 *
 * Kept free of Prisma imports so pure scoring checks can run without a database.
 */
const AREAS = [
  { name: 'Vidyanagar', lat: 15.3647, lon: 75.124 },
  { name: 'Gokul Road', lat: 15.3739, lon: 75.1039 },
  { name: 'Navanagar', lat: 15.361, lon: 75.085 },
  { name: 'Old Hubballi', lat: 15.3539, lon: 75.129 },
  { name: 'Keshwapur', lat: 15.37, lon: 75.133 },
  { name: 'Sattur', lat: 15.3345, lon: 75.118 },
  { name: 'Rayapur', lat: 15.384, lon: 75.09 },
  { name: 'Amargol', lat: 15.402, lon: 75.112 },
  { name: 'Unkal', lat: 15.377, lon: 75.118 },
];

export function areaLabel(lat: number, lon: number): string {
  let label = 'Hubballi';
  let shortest = Number.POSITIVE_INFINITY;
  for (const area of AREAS) {
    const distance = haversineKm({ lat, lon }, { lat: area.lat, lon: area.lon });
    if (distance < shortest) {
      shortest = distance;
      label = area.name;
    }
  }
  return label;
}
