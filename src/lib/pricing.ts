import { supabase } from '@/integrations/supabase/client';

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

export async function fetchPricingZones(): Promise<PricingZone[]> {
  const { data } = await supabase
    .from('pricing_zones')
    .select('*')
    .order('sort_order', { ascending: true });
  cachedZones = (data as any[] || []).map(z => ({
    ...z,
    fixed_price: z.fixed_price != null ? Number(z.fixed_price) : null,
    per_km_price: z.per_km_price != null ? Number(z.per_km_price) : null,
  }));
  return cachedZones;
}

export function invalidatePricingCache() {
  cachedZones = null;
}

export async function calculatePrice(distanceKm: number): Promise<{ price: number; priceDriver: number; priceCompany: number; zoneName: string }> {
  const zones = cachedZones || await fetchPricingZones();
  const adjustedDistance = distanceKm + 0.15;

  // Find matching zone
  let matchedZone: PricingZone | null = null;
  for (const zone of zones) {
    const maxKm = zone.max_km ?? Infinity;
    if (adjustedDistance >= zone.min_km && adjustedDistance < maxKm) {
      matchedZone = zone;
      break;
    }
    // Last zone (no max_km) catches everything above
    if (zone.max_km === null && adjustedDistance >= zone.min_km) {
      matchedZone = zone;
      break;
    }
  }

  if (!matchedZone) {
    // Fallback to last zone
    matchedZone = zones[zones.length - 1] || null;
  }

  let price = 0;
  let zoneName = matchedZone?.name || 'Sin zona';

  if (matchedZone) {
    if (matchedZone.fixed_price != null) {
      price = matchedZone.fixed_price;
    }
    if (matchedZone.per_km_price != null && matchedZone.max_km === null) {
      // Extra km pricing (for open-ended zones like Zona 3+)
      const extraKm = Math.max(0, adjustedDistance - matchedZone.min_km);
      price += extraKm * matchedZone.per_km_price;
    }
  }

  price = Math.round(price * 100) / 100;
  const priceDriver = Math.round(price * 0.7 * 100) / 100;
  const priceCompany = Math.round(price * 0.3 * 100) / 100;

  return { price, priceDriver, priceCompany, zoneName };
}

export function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return `${amount.toFixed(2)}€`;
}
