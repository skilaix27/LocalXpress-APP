import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Stop, Profile, DriverLocation, ProfileWithRole, AppRole } from '@/lib/supabase-types';

export function useAdminData() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<ProfileWithRole[]>([]);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .order('created_at', { ascending: false });

      if (stopsData) setStops(stopsData as Stop[]);

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

  const getDriverLocation = useCallback(
    (driverId: string) => driverLocations.find((loc) => loc.driver_id === driverId),
    [driverLocations]
  );

  const getDriverStopsCount = useCallback(
    (driverId: string) => stops.filter((s) => s.driver_id === driverId && s.status !== 'delivered').length,
    [stops]
  );

  // Filter: hide delivered stops from previous days in main views
  const todayStr = new Date().toDateString();
  const activeStops = stops.filter(
    (s) => s.status !== 'delivered' || new Date(s.delivered_at || s.updated_at).toDateString() === todayStr
  );

  const pendingStops = stops.filter((s) => s.status === 'pending').length;
  const assignedStops = stops.filter((s) => s.status === 'assigned').length;
  const pickedStops = stops.filter((s) => s.status === 'picked').length;
  const deliveredStops = activeStops.filter((s) => s.status === 'delivered').length;
  const activeDrivers = driverLocations.filter(
    (loc) => new Date(loc.updated_at).getTime() > Date.now() - 5 * 60 * 1000
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
    getDriverLocation,
    getDriverStopsCount,
    pendingStops,
    assignedStops,
    pickedStops,
    deliveredStops,
    activeDrivers,
  };
}
