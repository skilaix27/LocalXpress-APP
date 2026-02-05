import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StopCard } from '@/components/admin/StopCard';
import { DriverCard } from '@/components/admin/DriverCard';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stop, Profile, DriverLocation } from '@/lib/supabase-types';
import { Plus, Package, Users, Truck, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch stops
      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (stopsData) setStops(stopsData as Stop[]);

      // Fetch drivers (profiles with driver role)
      const { data: driversData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);
      
      if (driversData) setDrivers(driversData as Profile[]);

      // Fetch driver locations
      const { data: locationsData } = await supabase
        .from('driver_locations')
        .select('*');
      
      if (locationsData) setDriverLocations(locationsData as DriverLocation[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const stopsChannel = supabase
      .channel('stops-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stops' },
        () => fetchData()
      )
      .subscribe();

    const locationsChannel = supabase
      .channel('locations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stopsChannel);
      supabase.removeChannel(locationsChannel);
    };
  }, []);

  // Stats
  const pendingStops = stops.filter((s) => s.status === 'pending').length;
  const pickedStops = stops.filter((s) => s.status === 'picked').length;
  const deliveredStops = stops.filter((s) => s.status === 'delivered').length;
  const activeDrivers = driverLocations.filter(
    (loc) => new Date(loc.updated_at).getTime() > Date.now() - 5 * 60 * 1000
  ).length;

  const stats = [
    { label: 'Pendientes', value: pendingStops, icon: Package, color: 'text-muted-foreground' },
    { label: 'Recogidos', value: pickedStops, icon: Truck, color: 'text-status-picked' },
    { label: 'Entregados', value: deliveredStops, icon: CheckCircle, color: 'text-status-delivered' },
    { label: 'Repartidores', value: activeDrivers, icon: Users, color: 'text-primary' },
  ];

  const getDriverLocation = (driverId: string) => {
    return driverLocations.find((loc) => loc.driver_id === driverId);
  };

  const getDriverStopsCount = (driverId: string) => {
    return stops.filter((s) => s.driver_id === driverId && s.status !== 'delivered').length;
  };

  const getDriverById = (driverId: string | null) => {
    if (!driverId) return null;
    return drivers.find((d) => d.id === driverId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Gestión de repartos en tiempo real</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva parada
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="h-[500px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Mapa en tiempo real</CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[calc(100%-60px)]">
              <DeliveryMap
                stops={stops}
                driverLocations={driverLocations.map((loc) => ({
                  ...loc,
                  driver: getDriverById(loc.driver_id) || undefined,
                }))}
                selectedStopId={selectedStopId}
                onStopClick={(stop) => setSelectedStopId(stop.id)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Stops */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                Paradas recientes
                <span className="text-sm font-normal text-muted-foreground">
                  {stops.length} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-[300px] overflow-y-auto space-y-2">
              {stops.slice(0, 5).map((stop) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  driver={getDriverById(stop.driver_id)}
                  onClick={() => setSelectedStopId(stop.id)}
                />
              ))}
              {stops.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay paradas aún
                </p>
              )}
            </CardContent>
          </Card>

          {/* Drivers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Repartidores</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              {drivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  location={getDriverLocation(driver.id)}
                  activeStopsCount={getDriverStopsCount(driver.id)}
                />
              ))}
              {drivers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay repartidores registrados
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Stop Dialog */}
      <CreateStopDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        drivers={drivers}
        onSuccess={fetchData}
      />
    </div>
  );
}
