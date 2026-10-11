export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export const DEFAULT_CENTER: GeoPoint = { name: "Nairobi", lat: -1.2921, lng: 36.8219 };

export const DEMO_LOCATIONS: GeoPoint[] = [
  { name: "Nairobi Sender Hub", lat: -1.2921, lng: 36.8219 },
  { name: "JKIA Cargo Terminal", lat: -1.3192, lng: 36.9278 },
  { name: "Destination Branch", lat: -1.2649, lng: 36.8033 },
  { name: "Recipient door", lat: -1.2676, lng: 36.809 },
];

const BY_NAME = new Map(DEMO_LOCATIONS.map((l) => [normalize(l.name), l]));

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function coordsFor(location: string): { lat: number; lng: number } | null {
  const hit = BY_NAME.get(normalize(location));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

export function resolveCoords(cp: {
  location: string;
  lat?: number;
  lng?: number;
}): { lat: number; lng: number } | null {
  if (typeof cp.lat === "number" && typeof cp.lng === "number") {
    return { lat: cp.lat, lng: cp.lng };
  }
  return coordsFor(cp.location);
}
