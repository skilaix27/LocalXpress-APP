import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PricingZone } from '@/lib/pricing';
import { invalidatePricingCache } from '@/lib/pricing';
import { toast } from 'sonner';

export function usePricingZones() {
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    const { data, error } = await supabase
      .from('pricing_zones')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) {
      setZones((data as any[]).map(z => ({
        ...z,
        fixed_price: z.fixed_price != null ? Number(z.fixed_price) : null,
        per_km_price: z.per_km_price != null ? Number(z.per_km_price) : null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const updateZone = useCallback(async (id: string, updates: Partial<PricingZone>) => {
    const { error } = await supabase
      .from('pricing_zones')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast.error('Error al actualizar zona');
      return false;
    }
    invalidatePricingCache();
    await fetchZones();
    toast.success('Zona actualizada');
    return true;
  }, [fetchZones]);

  const addZone = useCallback(async (zone: Omit<PricingZone, 'id'>) => {
    const { error } = await supabase
      .from('pricing_zones')
      .insert(zone as any);
    if (error) {
      toast.error('Error al crear zona');
      return false;
    }
    invalidatePricingCache();
    await fetchZones();
    toast.success('Zona creada');
    return true;
  }, [fetchZones]);

  const deleteZone = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('pricing_zones')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Error al eliminar zona');
      return false;
    }
    invalidatePricingCache();
    await fetchZones();
    toast.success('Zona eliminada');
    return true;
  }, [fetchZones]);

  return { zones, loading, updateZone, addZone, deleteZone, refetch: fetchZones };
}
