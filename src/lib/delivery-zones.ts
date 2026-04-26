import { zonesApi } from '@/lib/api';

export interface PricingZone {
  id: string;
  name: string;
  min_km: number;
  max_km: number | null;
  fixed_price: number | null;
  per_km_price: number | null;
  sort_order: number;
}

let cachedZones: PricingZone[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export async function fetchPricingZones(): Promise<PricingZone[]> {
  if (cachedZones && Date.now() - cacheTime < CACHE_TTL) return cachedZones;
  const data = await zonesApi.list();
  if (data) {
    cachedZones = data as PricingZone[];
    cacheTime = Date.now();
  }
  return cachedZones || [];
}

export function invalidateZonesCache() {
  cachedZones = null;
  cacheTime = 0;
}

const MARGIN_KM = 0.15; // margen: si le faltan ≤150m para la siguiente zona, sube

export function adjustDistance(distanceKm: number): number {
  return Math.round((distanceKm + MARGIN_KM) * 100) / 100;
}

/**
 * Dado un array de zonas y una distancia, devuelve la zona aplicable.
 * Si la distancia está a ≤ MARGIN_KM del límite superior, sube a la siguiente zona.
 */
export function resolveZone(zones: PricingZone[], distanceKm: number): PricingZone | null {
  if (!zones.length) return null;
  const adjusted = distanceKm + MARGIN_KM;
  for (const z of zones) {
    const maxKm = z.max_km ?? Infinity;
    if (adjusted > z.min_km && adjusted <= maxKm) return z;
  }
  // If beyond all zones, return last
  return zones[zones.length - 1];
}

export function getZonePrice(zone: PricingZone | null, distanceKm: number): number | null {
  if (!zone) return null;
  if (zone.fixed_price != null) return zone.fixed_price;
  if (zone.per_km_price != null) {
    const extraKm = Math.max(0, distanceKm - zone.min_km);
    return Math.round(zone.per_km_price * extraKm * 100) / 100;
  }
  return null;
}

// Backward-compatible sync helpers (use hardcoded fallback if zones not loaded yet)
export function getDeliveryZone(distanceKm: number): string {
  if (cachedZones?.length) {
    const z = resolveZone(cachedZones, distanceKm);
    return z?.name || 'Sin zona';
  }
  // Fallback
  const adj = distanceKm + MARGIN_KM;
  if (adj <= 2.5) return 'Zona 1';
  if (adj <= 7) return 'Zona 2';
  if (adj <= 15) return 'Zona 3';
  return 'Zona 4+';
}

export function getDeliveryPrice(distanceKm: number): number | null {
  if (cachedZones?.length) {
    const z = resolveZone(cachedZones, distanceKm);
    return getZonePrice(z, distanceKm);
  }
  return null;
}

export function getDeliveryZoneWithPrice(distanceKm: number): { zone: string; price: number | null } {
  return {
    zone: getDeliveryZone(distanceKm),
    price: getDeliveryPrice(distanceKm),
  };
}

export function getDeliveryZoneWithRange(distanceKm: number): string {
  if (cachedZones?.length) {
    const z = resolveZone(cachedZones, distanceKm);
    if (!z) return 'Sin zona';
    const rangeStr = z.max_km != null ? `${z.min_km}–${z.max_km} km` : `+${z.min_km} km`;
    return `${z.name} (${rangeStr})`;
  }
  return getDeliveryZone(distanceKm);
}
