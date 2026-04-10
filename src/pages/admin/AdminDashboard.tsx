import { useState, useMemo } from 'react';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StopCard } from '@/components/admin/StopCard';
import { DriverCard } from '@/components/admin/DriverCard';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { Plus, Package, Users, Truck, CheckCircle, TrendingUp, UserCheck, Euro, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminData } from '@/hooks/useAdminData';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/pricing';

export default function AdminDashboard() {
  const {
    stops, allStops, drivers, driverLocations, loading, fetchData,
    getDriverById, getShopById, getDriverLocation, getDriverStopsCount,
    pendingStops, assignedStops, pickedStops, deliveredStops, activeDrivers, allUsers,
  } = useAdminData();

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const navigate = useNavigate();

  const totalToday = useMemo(() => stops.filter(
    (s) => new Date(s.created_at).toDateString() === new Date().toDateString()
  ).length, [stops]);

  const financials = useMemo(() => {
    const total = allStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
    const driverTotal = allStops.reduce((s, st) => s + (Number(st.price_driver) || 0), 0);
    const companyTotal = allStops.reduce((s, st) => s + (Number(st.price_company) || 0), 0);
    return { total, driverTotal, companyTotal };
  }, [allStops]);

  const stats = [
    { label: 'Sin asignar', value: pendingStops, icon: Package, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Asignados', value: assignedStops, icon: UserCheck, color: 'text-status-assigned', bg: 'bg-[hsl(var(--status-assigned-bg))]' },
    { label: 'Recogidos', value: pickedStops, icon: Truck, color: 'text-status-picked', bg: 'bg-[hsl(var(--status-picked-bg))]' },
    { label: 'Entregados', value: deliveredStops, icon: CheckCircle, color: 'text-status-delivered', bg: 'bg-[hsl(var(--status-delivered-bg))]' },
    { label: 'Repartidores activos', value: activeDrivers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const handleStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Panel de control</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Visión global de tu flota en tiempo real</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nueva parada</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="overflow-hidden">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Summary banner */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Resumen del día</p>
            <p className="text-xs text-muted-foreground">
              {totalToday} paradas hoy · {allStops.length} total · {drivers.length} repartidores
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm shrink-0">
            <div className="text-center">
              <p className="font-bold text-primary">{formatPrice(financials.total)}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{formatPrice(financials.driverTotal)}</p>
              <p className="text-[10px] text-muted-foreground">Repart. 70%</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{formatPrice(financials.companyTotal)}</p>
              <p className="text-[10px] text-muted-foreground">Empresa 30%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map + Recent */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <Card className="h-[250px] sm:h-[500px] overflow-hidden">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                Mapa en tiempo real
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/map')}>
                  Ver completo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[calc(100%-60px)]">
              <DeliveryMap
                stops={stops.filter((s) => s.status !== 'delivered')}
                driverLocations={driverLocations
                  .filter((loc) => new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000)
                  .map((loc) => ({
                  ...loc,
                  driver: getDriverById(loc.driver_id) || undefined,
                }))}
                selectedStopId={selectedStop?.id}
                onStopClick={handleStopClick}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Recent stops */}
          <Card>
            <CardHeader className="pb-2 px-3 pt-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                Paradas recientes
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/stops')}>
                  Ver todas
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-[280px] overflow-y-auto space-y-2">
              {stops.slice(0, 5).map((stop) => (
                <StopCard key={stop.id} stop={stop} driver={getDriverById(stop.driver_id)} shopName={stop.shop_name} onClick={() => handleStopClick(stop)} />
              ))}
              {stops.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay paradas aún</p>
              )}
            </CardContent>
          </Card>

          {/* Drivers */}
          <Card>
            <CardHeader className="pb-2 px-3 pt-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                Repartidores
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/drivers')}>
                  Ver todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              {drivers.slice(0, 4).map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  location={getDriverLocation(driver.id)}
                  activeStopsCount={getDriverStopsCount(driver.id)}
                />
              ))}
              {drivers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay repartidores registrados</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateStopDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} drivers={drivers} shops={allUsers.filter(u => u.role === 'shop')} onSuccess={fetchData} />
      <StopDetailDialog stop={selectedStop} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} drivers={drivers} onUpdate={fetchData} shopName={selectedStop?.shop_name} />
    </div>
  );
}
