export interface Coordinates {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle (straight-line) distance in kilometres.
 * Locations are stored as coordinates and compared by straight-line distance,
 * so the Haversine formula is the authoritative calculation.
 */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Assumed average urban speed for response ETAs. Hubballi traffic is dense, so
 * 35 km/h (1.71 min per km) is a conservative planning figure; it is an
 * assumption, not live traffic data.
 */
export const AVERAGE_SPEED_KMH = 35;

/** Minimum turnaround even for a vehicle parked at the scene. */
export const MIN_ETA_MINUTES = 3;

/** ETA in whole minutes from a straight-line distance. */
export function etaMinutes(distanceKm: number): number {
  const minutes = (distanceKm / AVERAGE_SPEED_KMH) * 60;
  return Math.max(MIN_ETA_MINUTES, Math.round(minutes));
}
