import { useState, useEffect, useCallback } from 'react';
import { zonesApi } from '@/lib/api';
import type { PricingZone } from '@/lib/delivery-zones';
import { invalidateZonesCache } from '@/lib/delivery-zones';

export function usePricingZones() {
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    const data = await zonesApi.list();
    setZones(data as PricingZone[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const saveZone = async (zone: Partial<PricingZone> & { id?: string }) => {
    if (zone.id) {
      await zonesApi.update(zone.id, {
        name: zone.name,
        min_km: zone.min_km,
        max_km: zone.max_km,
        fixed_price: zone.fixed_price,
        per_km_price: zone.per_km_price,
        sort_order: zone.sort_order,
      });
    } else {
      await zonesApi.create({
        name: zone.name!,
        min_km: zone.min_km!,
        max_km: zone.max_km,
        fixed_price: zone.fixed_price,
        per_km_price: zone.per_km_price,
        sort_order: zone.sort_order ?? zones.length + 1,
      });
    }
    invalidateZonesCache();
    await fetchZones();
  };

  const deleteZone = async (id: string) => {
    await zonesApi.delete(id);
    invalidateZonesCache();
    await fetchZones();
  };

  return { zones, loading, fetchZones, saveZone, deleteZone };
}
