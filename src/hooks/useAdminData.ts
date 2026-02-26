import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Stop, Profile, DriverLocation, ProfileWithRole, AppRole } from '@/lib/supabase-types';
import { toast } from 'sonner';

export function useAdminData() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<ProfileWithRole[]>([]);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const prevStopIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .order('created_at', { ascending: false });

      if (stopsData) {
        const newStops = stopsData as Stop[];
        
        // Detect new pending stops (not on first load)
        if (!isFirstLoadRef.current) {
          const prevIds = prevStopIdsRef.current;
          for (const stop of newStops) {
            if (!prevIds.has(stop.id) && stop.status === 'pending') {
              // Play notification sound
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJOqr6GHaV5wiKu3qIxsYXSVsLqnj29leJayuaSLbGN3l7S8p4pqYnaXtbynimhgdZe1vKeKaWF2l7W7polpYXaXtbunimlidpe0uqaJaWJ2l7S6poloYnWWtLqmh2hidZa0uqaHaGJ1lrS5podpYnWWs7mmh2lidZazuaaHaWJ1lrO5poZoYnWWs7imhmhidZWzuKaGaGJ1lbO4poZoYXWVs7imhmhhdZWzuKWGaGF1lbO4pYZoYXSVsrilhmhhdJWyt6WGZ2F0lbK3pYZnYXSVsrelhmhhdJWyt6WFZ2F0lbK3pYVnYXSUsrelhoVnYHSUsrelhoVnYHSUsbekhWdgdJSxt6SGZ2B0lLG3pIZnYHSUsbekhWdfc5Sxt6SGZ2BzlLG3pIVnX3OUsbakhWdfc5OxtqSFZ19zk7G2pIVnX3OTsbakg2dgc5OxtqSDZ19zk7G2pINnX3OTsbWkg2dfc5OxtaSCZ19yk7G1pINnXnKTsbWkg2dec5OxtaOCZl5yk7G1o4JmXnKTsLWjgmZecpOwtaOCZl5yk7C1o4JmXnKTsLWjgmVecpOwtaOBZV5ykrC0o4FlXXKSsLSigGVdcpKwtKKAZV1ykrC0ooBlXXKSsLSif2VdcpKws6J/ZV1ykbCzon9lXXKRsLOif2RdcpGws6J/ZFxykbCzon5kXHKRr7Oif2RccpGvs6F+ZFxykK+zoX5kXHGQr7OhfmNccZCvs6F+Y1xxkK+yoX5jXHGQr7KhfWNccZCvsqF9Y1xxkK+yoH1jW3GQr7KgfWNbcZCvsqB9Y1txj6+yoH1jW3GPr7KgfGNbcY+vsqB8Y1pxj6+yn3xjWnGPrrKffGNacY+usp98YlpxjqoA');
                audio.volume = 0.5;
                audio.play().catch(() => {});
              } catch {}
              
              toast.info('🆕 Nuevo pedido recibido', {
                description: `${stop.order_code || stop.client_name} — ${stop.shop_name || 'Tienda'}`,
                duration: 8000,
              });
            }
          }
        }
        
        // Update tracking set
        prevStopIdsRef.current = new Set(newStops.map(s => s.id));
        isFirstLoadRef.current = false;
        
        setStops(newStops);
      }

      // Fetch all roles and profiles
      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (allRoles && allRoles.length > 0) {
        const allUserIds = [...new Set(allRoles.map((r) => r.user_id))];
        const driverUserIds = allRoles.filter((r) => r.role === 'driver').map((r) => r.user_id);

        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', allUserIds);

        if (allProfilesData) {
          // Build role map
          const roleMap = new Map<string, AppRole>();
          for (const r of allRoles) {
            roleMap.set(r.user_id, r.role as AppRole);
          }

          const usersWithRoles: ProfileWithRole[] = allProfilesData.map((p) => ({
            ...(p as Profile),
            role: roleMap.get(p.user_id) || 'driver',
          }));
          setAllUsers(usersWithRoles);

          // Keep drivers list for backward compat
          const activeDrivers = (allProfilesData as Profile[])
            .filter((p) => driverUserIds.includes(p.user_id) && p.is_active);
          setDrivers(activeDrivers);
        }
      } else {
        setDrivers([]);
        setAllUsers([]);
      }

      const { data: locationsData } = await supabase
        .from('driver_locations')
        .select('*');

      if (locationsData) setDriverLocations(locationsData as DriverLocation[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const stopsChannel = supabase
      .channel('stops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => fetchData())
      .subscribe();

    const locationsChannel = supabase
      .channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(stopsChannel);
      supabase.removeChannel(locationsChannel);
    };
  }, [fetchData]);

  const getDriverById = useCallback(
    (driverId: string | null) => {
      if (!driverId) return null;
      return drivers.find((d) => d.id === driverId) || null;
    },
    [drivers]
  );

  const getShopById = useCallback(
    (shopId: string | null) => {
      if (!shopId) return null;
      return allUsers.find((u) => u.id === shopId && u.role === 'shop') || null;
    },
    [allUsers]
  );

  const getDriverLocation = useCallback(
    (driverId: string) => driverLocations.find((loc) => loc.driver_id === driverId),
    [driverLocations]
  );

  const getDriverStopsCount = useCallback(
    (driverId: string) => stops.filter((s) => s.driver_id === driverId && s.status !== 'delivered').length,
    [stops]
  );

  // A stop goes to history if: delivered OR scheduled for a previous day and still not delivered
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const isExpiredOrDone = (s: Stop) =>
    s.status === 'delivered' ||
    (s.scheduled_pickup_at && new Date(s.scheduled_pickup_at) < todayStart && s.status !== 'picked');

  const activeStops = stops.filter((s) => !isExpiredOrDone(s));

  const pendingStops = activeStops.filter((s) => s.status === 'pending').length;
  const assignedStops = activeStops.filter((s) => s.status === 'assigned').length;
  const pickedStops = activeStops.filter((s) => s.status === 'picked').length;
  const deliveredStops = stops.filter((s) => s.status === 'delivered').length;
  const activeDrivers = driverLocations.filter(
    (loc) => new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000
  ).length;

  return {
    stops: activeStops,
    allStops: stops,
    drivers,
    allUsers,
    driverLocations,
    loading,
    fetchData,
    getDriverById,
    getShopById,
    getDriverLocation,
    getDriverStopsCount,
    pendingStops,
    assignedStops,
    pickedStops,
    deliveredStops,
    activeDrivers,
  };
}
