import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  const fetchStops = useCallback(async () => {
    const { data } = await supabase
      .from('stops')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const newStops = data as Stop[];

      if (!isFirstLoadRef.current) {
        const prevIds = prevStopIdsRef.current;
        for (const stop of newStops) {
          if (!prevIds.has(stop.id) && stop.status === 'pending') {
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

      prevStopIdsRef.current = new Set(newStops.map(s => s.id));
      isFirstLoadRef.current = false;
      setStops(newStops);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
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
        const roleMap = new Map<string, AppRole>();
        for (const r of allRoles) {
          roleMap.set(r.user_id, r.role as AppRole);
        }

        const usersWithRoles: ProfileWithRole[] = allProfilesData.map((p) => ({
          ...(p as Profile),
          role: roleMap.get(p.user_id) || 'driver',
        }));
        setAllUsers(usersWithRoles);

        const activeDrivers = (allProfilesData as Profile[])
          .filter((p) => driverUserIds.includes(p.user_id) && p.is_active);
        setDrivers(activeDrivers);
      }
    } else {
      setDrivers([]);
      setAllUsers([]);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from('driver_locations')
      .select('*');
    if (data) setDriverLocations(data as DriverLocation[]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Run all three queries in parallel
      await Promise.all([fetchStops(), fetchUsers(), fetchLocations()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStops, fetchUsers, fetchLocations]);

  // Separate debounced fetchers for different event types
  const debouncedStopsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLocationsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUsersRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFetchStops = useCallback(() => {
    if (debouncedStopsRef.current) clearTimeout(debouncedStopsRef.current);
    debouncedStopsRef.current = setTimeout(() => fetchStops(), 400);
  }, [fetchStops]);

  const debouncedFetchLocations = useCallback(() => {
    if (debouncedLocationsRef.current) clearTimeout(debouncedLocationsRef.current);
    debouncedLocationsRef.current = setTimeout(() => fetchLocations(), 2000);
  }, [fetchLocations]);

  const debouncedFetchUsers = useCallback(() => {
    if (debouncedUsersRef.current) clearTimeout(debouncedUsersRef.current);
    debouncedUsersRef.current = setTimeout(() => fetchUsers(), 500);
  }, [fetchUsers]);

  useEffect(() => {
    fetchData();

    const stopsChannel = supabase
      .channel('stops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => debouncedFetchStops())
      .subscribe();

    const locationsChannel = supabase
      .channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => debouncedFetchLocations())
      .subscribe();

    const profilesChannel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => debouncedFetchUsers())
      .subscribe();

    const rolesChannel = supabase
      .channel('roles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => debouncedFetchUsers())
      .subscribe();

    return () => {
      if (debouncedStopsRef.current) clearTimeout(debouncedStopsRef.current);
      if (debouncedLocationsRef.current) clearTimeout(debouncedLocationsRef.current);
      if (debouncedUsersRef.current) clearTimeout(debouncedUsersRef.current);
      supabase.removeChannel(stopsChannel);
      supabase.removeChannel(locationsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [fetchData, debouncedFetchStops, debouncedFetchLocations, debouncedFetchUsers]);

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

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isExpiredOrDone = useCallback((s: Stop) => {
    if (s.status === 'delivered') return true;
    if (s.scheduled_pickup_at && s.status !== 'picked') {
      const scheduledDate = new Date(s.scheduled_pickup_at);
      scheduledDate.setHours(23, 59, 59, 999);
      return scheduledDate < todayStart;
    }
    return false;
  }, [todayStart]);

  const activeStops = useMemo(() => stops.filter((s) => !isExpiredOrDone(s)), [stops, isExpiredOrDone]);

  const pendingStops = useMemo(() => activeStops.filter((s) => s.status === 'pending').length, [activeStops]);
  const assignedStops = useMemo(() => activeStops.filter((s) => s.status === 'assigned').length, [activeStops]);
  const pickedStops = useMemo(() => activeStops.filter((s) => s.status === 'picked').length, [activeStops]);
  const deliveredStops = useMemo(() => stops.filter((s) => s.status === 'delivered').length, [stops]);
  const activeDrivers = useMemo(() => driverLocations.filter(
    (loc) => new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000
  ).length, [driverLocations]);

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
