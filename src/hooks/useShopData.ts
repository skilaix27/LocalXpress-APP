import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Stop } from '@/lib/supabase-types';
import { toast } from 'sonner';

export function useShopData() {
  const { profile } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const prevStopsRef = useRef<Map<string, Stop>>(new Map());

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('shop_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) {
        const newStops = data as Stop[];
        
        // Check for newly assigned stops (status changed to 'assigned')
        const prevMap = prevStopsRef.current;
        if (prevMap.size > 0) {
          for (const stop of newStops) {
            const prev = prevMap.get(stop.id);
            if (prev && prev.status !== 'assigned' && stop.status === 'assigned') {
              toast.success('🚀 Repartidor asignado', {
                description: `Tu pedido ${stop.order_code || stop.client_name} ya tiene repartidor asignado`,
                duration: 6000,
              });
            }
          }
        }
        
        // Update ref
        const newMap = new Map<string, Stop>();
        for (const s of newStops) newMap.set(s.id, s);
        prevStopsRef.current = newMap;
        
        setStops(newStops);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const debouncedFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetch = useCallback(() => {
    if (debouncedFetchRef.current) clearTimeout(debouncedFetchRef.current);
    debouncedFetchRef.current = setTimeout(() => fetchData(), 500);
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('shop-stops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => debouncedFetch())
      .subscribe();

    return () => {
      if (debouncedFetchRef.current) clearTimeout(debouncedFetchRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchData, debouncedFetch]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isExpiredOrDone = useCallback((s: Stop) =>
    s.status === 'delivered' ||
    (s.scheduled_pickup_at && new Date(s.scheduled_pickup_at) < todayStart && s.status !== 'picked'),
  [todayStart]);

  const activeStops = useMemo(() => stops.filter((s) => !isExpiredOrDone(s)), [stops, isExpiredOrDone]);
  const deliveredStops = useMemo(() => stops.filter((s) => isExpiredOrDone(s)), [stops, isExpiredOrDone]);

  const pendingCount = useMemo(() => activeStops.filter((s) => s.status === 'pending').length, [activeStops]);
  const assignedCount = useMemo(() => activeStops.filter((s) => s.status === 'assigned').length, [activeStops]);
  const pickedCount = useMemo(() => activeStops.filter((s) => s.status === 'picked').length, [activeStops]);

  const todayDelivered = useMemo(() => deliveredStops.filter((s) => {
    const d = new Date(s.delivered_at || s.updated_at);
    return d >= todayStart;
  }), [deliveredStops, todayStart]);

  const olderDelivered = useMemo(() => deliveredStops.filter((s) => {
    const d = new Date(s.delivered_at || s.updated_at);
    return d < todayStart;
  }), [deliveredStops, todayStart]);

  const deliveredCount = deliveredStops.length;

  return {
    stops,
    activeStops,
    deliveredStops,
    todayDelivered,
    olderDelivered,
    loading,
    fetchData,
    pendingCount,
    assignedCount,
    pickedCount,
    deliveredCount,
  };
}
