import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { stopsApi, fetchAllPages } from '@/lib/api';
import { fetchPricingZones } from '@/lib/delivery-zones';
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
      fetchPricingZones().catch(() => {});
      // Backend filters stops by shop_id automatically for shop role
      const newStops = await fetchAllPages<Stop>((page) =>
        stopsApi.list({ page, limit: 100 }) as Promise<{ data: Stop[]; total: number; totalPages: number }>
      );

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

      const newMap = new Map<string, Stop>();
      for (const s of newStops) newMap.set(s.id, s);
      prevStopsRef.current = newMap;

      setStops(newStops);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
    const pollingInterval = setInterval(() => fetchData(), 8000);
    return () => clearInterval(pollingInterval);
  }, [fetchData]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isDelivered = useCallback((s: Stop) => s.status === 'delivered', []);

  const activeStops = useMemo(() => stops.filter((s) => !isDelivered(s)), [stops, isDelivered]);
  const deliveredStops = useMemo(() => stops.filter((s) => isDelivered(s)), [stops, isDelivered]);

  const pendingCount = useMemo(() => activeStops.filter((s) => s.status === 'pending').length, [activeStops]);
  const assignedCount = useMemo(() => activeStops.filter((s) => s.status === 'assigned').length, [activeStops]);
  const pickedCount = useMemo(() => activeStops.filter((s) => s.status === 'picked').length, [activeStops]);

  const todayDelivered = useMemo(
    () =>
      deliveredStops.filter((s) => {
        const d = new Date(s.delivered_at || s.updated_at);
        return d >= todayStart;
      }),
    [deliveredStops, todayStart]
  );

  const olderDelivered = useMemo(
    () =>
      deliveredStops.filter((s) => {
        const d = new Date(s.delivered_at || s.updated_at);
        return d < todayStart;
      }),
    [deliveredStops, todayStart]
  );

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
