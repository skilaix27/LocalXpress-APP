import { useState, useEffect, useCallback, useRef } from 'react';
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

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('shop-stops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // A stop goes to history if: delivered OR scheduled for a previous day and not picked/in-transit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const isExpiredOrDone = (s: Stop) =>
    s.status === 'delivered' ||
    (s.scheduled_pickup_at && new Date(s.scheduled_pickup_at) < todayStart && s.status !== 'picked');

  const activeStops = stops.filter((s) => !isExpiredOrDone(s));

  // History: all that are NOT active
  const deliveredStops = stops.filter((s) => isExpiredOrDone(s));

  const pendingCount = activeStops.filter((s) => s.status === 'pending').length;
  const assignedCount = activeStops.filter((s) => s.status === 'assigned').length;
  const pickedCount = activeStops.filter((s) => s.status === 'picked').length;

  // Split delivered: today vs older
  const todayDelivered = deliveredStops.filter((s) => {
    const d = new Date(s.delivered_at || s.updated_at);
    return d >= todayStart;
  });
  const olderDelivered = deliveredStops.filter((s) => {
    const d = new Date(s.delivered_at || s.updated_at);
    return d < todayStart;
  });

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
