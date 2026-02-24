import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Stop } from '@/lib/supabase-types';

export function useShopData() {
  const { profile } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('shop_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) setStops(data as Stop[]);
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

  const todayStr = new Date().toDateString();

  // Active stops: pending + picked
  const activeStops = stops.filter((s) => s.status !== 'delivered');

  // Delivered today
  const deliveredToday = stops.filter(
    (s) => s.status === 'delivered' && new Date(s.delivered_at || s.updated_at).toDateString() === todayStr
  );

  // All delivered (history)
  const deliveredStops = stops.filter((s) => s.status === 'delivered');

  const pendingCount = stops.filter((s) => s.status === 'pending').length;
  const pickedCount = stops.filter((s) => s.status === 'picked').length;
  const deliveredCount = deliveredStops.length;

  return {
    stops,
    activeStops,
    deliveredToday,
    deliveredStops,
    loading,
    fetchData,
    pendingCount,
    pickedCount,
    deliveredCount,
  };
}
