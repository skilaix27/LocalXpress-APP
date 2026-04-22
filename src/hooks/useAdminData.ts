import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { stopsApi, profilesApi, locationsApi, fetchAllPages } from '@/lib/api';
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
    const newStops = await fetchAllPages<Stop>((page) =>
      stopsApi.list({ page, limit: 100 }) as Promise<{ data: Stop[]; total: number; totalPages: number }>
    );

    if (!isFirstLoadRef.current) {
      const prevIds = prevStopIdsRef.current;
      for (const stop of newStops) {
        if (!prevIds.has(stop.id) && stop.status === 'pending') {
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJOqr6GHaV5wiKu3qIxsYXSVsLqnj29leJayuaSLbGN3l7S8p4pqYnaXtbynimhgdZe1vKeKaWF2l7W7polpYXaXtbunimlidpe0uqaJaWJ2l7S6poloYnWWtLqmh2hidZa0uqaHaGJ1lrS5podpYnWWs7mmh2lidZazuaaHaWJ1lrO5poZoYnWWs7imhmhidZWzuKaGaGJ1lbO4poZoYXWVs7imhmhhdZWzuKWGaGF1lbO4pYZoYXSVsrilhmhhdJWyt6WGZ2F0lbK3pYZnYXSVsrelhmhhdJWyt6WFZ2F0lbK3pYVnYXSUsrelhoVnYHSUsrelhoVnYHSUsbekhWdgdJSxt6SGZ2B0lLG3pIZnYHSUsbekhWdfc5Sxt6SGZ2BzlLG3pIVnX3OUsbakhWdfc5OxtqSFZ19zk7G2pIVnX3OTsbakg2dgc5OxtqSDZ19zk7G2pINnX3OTsbWkg2dfc5OxtaSCZ19yk7G1pINnXnKTsbWkg2dec5OxtaOCZl5yk7C1o4JmXnKTsLWjgmZecpOwtaOCZl5yk7C1o4JmXnKTsLWjgmVecpOwtaOBZV5ykrC0o4FlXXKSsLSigGVdcpKwtKKAZV1ykrC0ooBlXXKSsLSif2VdcpKws6J/ZV1ykbCzon9lXXKRsLOif2RdcpGws6J/ZFxykbCzon5kXHKRr7Oif2RccpGvs6F+ZFxykK+zn35kXHGQr7OhfmNccZCvs6F+Y1xxkK+yoX5jXHGQr7KhfWNccZCvsqF9Y1xxkK+yoH1jW3GQr7KgfWNbcZCvsqB9Y1txj6+yoH1jW3GPr7KgfGNbcY+vsqB8Y1pxj6+yn3xjWnGPrrKffGNacY+usp98YlpxjqoA');
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

    prevStopIdsRef.current = new Set(newStops.map((s) => s.id));
    isFirstLoadRef.current = false;
    setStops(newStops);
  }, []);

  const fetchUsers = useCallback(async () => {
    const profiles = await profilesApi.listAll();
    const usersWithRoles: ProfileWithRole[] = profiles.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      shop_name: p.shop_name,
      default_pickup_address: p.default_pickup_address,
      default_pickup_lat: p.default_pickup_lat,
      default_pickup_lng: p.default_pickup_lng,
      privacy_accepted_at: p.privacy_accepted_at,
      role: p.role as AppRole,
    }));
    setAllUsers(usersWithRoles);
    const activeDrivers = usersWithRoles.filter((u) => u.role === 'driver' && u.is_active);
    setDrivers(activeDrivers);
  }, []);

  const fetchLocations = useCallback(async () => {
    const data = await locationsApi.list();
    setDriverLocations(data as DriverLocation[]);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([fetchStops(), fetchUsers(), fetchLocations()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStops, fetchUsers, fetchLocations]);

  useEffect(() => {
    fetchData();
    const pollingInterval = setInterval(() => {
      fetchStops();
      fetchLocations();
    }, 10000);
    return () => clearInterval(pollingInterval);
  }, [fetchData, fetchStops, fetchLocations]);

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

  const isExpiredOrDone = useCallback(
    (s: Stop) => {
      if (s.status === 'delivered') return true;
      if (s.scheduled_pickup_at && s.status !== 'picked') {
        const scheduledDate = new Date(s.scheduled_pickup_at);
        scheduledDate.setHours(23, 59, 59, 999);
        return scheduledDate < todayStart;
      }
      return false;
    },
    [todayStart]
  );

  const activeStops = useMemo(() => stops.filter((s) => !isExpiredOrDone(s)), [stops, isExpiredOrDone]);

  const pendingStops = useMemo(() => activeStops.filter((s) => s.status === 'pending').length, [activeStops]);
  const assignedStops = useMemo(() => activeStops.filter((s) => s.status === 'assigned').length, [activeStops]);
  const pickedStops = useMemo(() => activeStops.filter((s) => s.status === 'picked').length, [activeStops]);
  const deliveredStops = useMemo(() => stops.filter((s) => s.status === 'delivered').length, [stops]);
  const activeDrivers = useMemo(
    () =>
      driverLocations.filter(
        (loc) => new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000
      ).length,
    [driverLocations]
  );

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
