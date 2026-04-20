import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PricingZone } from '@/lib/delivery-zones';
import { invalidateZonesCache } from '@/lib/delivery-zones';

export function usePricingZones() {
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    const { data } = await supabase
      .from('pricing_zones')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setZones(data as PricingZone[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const saveZone = async (zone: Partial<PricingZone> & { id?: string }) => {
    if (zone.id) {
      const { error } = await supabase.from('pricing_zones').update({
        name: zone.name,
        min_km: zone.min_km,
        max_km: zone.max_km,
        fixed_price: zone.fixed_price,
        per_km_price: zone.per_km_price,
        sort_order: zone.sort_order,
      }).eq('id', zone.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('pricing_zones').insert({
        name: zone.name!,
        min_km: zone.min_km!,
        max_km: zone.max_km,
        fixed_price: zone.fixed_price,
        per_km_price: zone.per_km_price,
        sort_order: zone.sort_order ?? zones.length + 1,
      });
      if (error) throw error;
    }
    invalidateZonesCache();
    await fetchZones();
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from('pricing_zones').delete().eq('id', id);
    if (error) throw error;
    invalidateZonesCache();
    await fetchZones();
  };

  return { zones, loading, fetchZones, saveZone, deleteZone };
}
