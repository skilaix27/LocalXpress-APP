import { useState, useMemo } from 'react';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { Plus, Package, Users, Truck, CheckCircle, TrendingUp, UserCheck, Euro, Hash, DollarSign, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminData } from '@/hooks/useAdminData';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '@/lib/pricing';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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

  const todayStr = new Date().toDateString();
  const todayStops = useMemo(() => allStops.filter(s => new Date(s.created_at).toDateString() === todayStr), [allStops, todayStr]);

  const financials = useMemo(() => {
    const total = allStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
    const driverTotal = allStops.reduce((s, st) => s + (Number(st.price_driver) || 0), 0);
    const companyTotal = allStops.reduce((s, st) => s + (Number(st.price_company) || 0), 0);
    const clientUnpaid = allStops.filter(s => s.status === 'delivered' && !s.paid_by_client).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const driverUnpaid = allStops.filter(s => s.status === 'delivered' && !s.paid_to_driver).reduce((sum, s) => sum + (Number(s.price_driver) || 0), 0);
    return { total, driverTotal, companyTotal, clientUnpaid, driverUnpaid };
  }, [allStops]);

  const stats = [
    { label: 'Sin asignar', value: pendingStops, icon: Package, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Asignados', value: assignedStops, icon: UserCheck, color: 'text-status-assigned', bg: 'bg-[hsl(var(--status-assigned-bg))]' },
    { label: 'Recogidos', value: pickedStops, icon: Truck, color: 'text-status-picked', bg: 'bg-[hsl(var(--status-picked-bg))]' },
    { label: 'Entregados', value: deliveredStops, icon: CheckCircle, color: 'text-status-delivered', bg: 'bg-[hsl(var(--status-delivered-bg))]' },
    { label: 'Repart. activos', value: activeDrivers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Panel de control</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Visión global en tiempo real</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Nueva parada</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-xl ${stat.bg}`}><stat.icon className={`w-5 h-5 ${stat.color}`} /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3 text-center">
            <Euro className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-primary">{formatPrice(financials.total)}</p>
            <p className="text-[10px] text-muted-foreground">Facturación total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{formatPrice(financials.driverTotal)}</p>
            <p className="text-[10px] text-muted-foreground">Repartidores (70%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{formatPrice(financials.companyTotal)}</p>
            <p className="text-[10px] text-muted-foreground">Empresa (30%)</p>
          </CardContent>
        </Card>
        <Card className={financials.clientUnpaid > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${financials.clientUnpaid > 0 ? 'text-destructive' : ''}`}>{formatPrice(financials.clientUnpaid)}</p>
            <p className="text-[10px] text-muted-foreground">Pend. cobro clientes</p>
          </CardContent>
        </Card>
        <Card className={financials.driverUnpaid > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${financials.driverUnpaid > 0 ? 'text-destructive' : ''}`}>{formatPrice(financials.driverUnpaid)}</p>
            <p className="text-[10px] text-muted-foreground">Pend. pago drivers</p>
          </CardContent>
        </Card>
      </div>

      {/* Day summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0"><TrendingUp className="w-5 h-5 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Resumen del día</p>
            <p className="text-xs text-muted-foreground">
              {todayStops.length} paradas hoy · {allStops.length} total · {drivers.length} repartidores · {allUsers.filter(u => u.role === 'shop').length} tiendas
            </p>
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
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/map')}>Ver completo</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[calc(100%-60px)]">
              <DeliveryMap
                stops={stops.filter((s) => s.status !== 'delivered')}
                driverLocations={driverLocations
                  .filter((loc) => new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000)
                  .map((loc) => ({ ...loc, driver: getDriverById(loc.driver_id) || undefined }))}
                selectedStopId={selectedStop?.id}
                onStopClick={handleStopClick}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Recent stops - compact */}
          <Card>
            <CardHeader className="pb-2 px-3 pt-4">
              <CardTitle className="text-base flex items-center justify-between">
                Últimos pedidos
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/stops')}>Ver todos</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-[350px] overflow-y-auto">
              <div className="divide-y">
                {allStops.slice(0, 8).map((stop) => (
                  <div key={stop.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded cursor-pointer transition-colors" onClick={() => handleStopClick(stop)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{stop.client_name}</span>
                        {stop.order_code && <span className="text-[9px] font-mono bg-muted px-1 rounded">{stop.order_code}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{stop.shop_name || stop.delivery_address}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={stop.status} />
                      {stop.price != null && <p className="text-[10px] font-semibold text-primary mt-0.5">{formatPrice(Number(stop.price))}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {allStops.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No hay pedidos</p>}
            </CardContent>
          </Card>

          {/* Active drivers */}
          <Card>
            <CardHeader className="pb-2 px-3 pt-4">
              <CardTitle className="text-base flex items-center justify-between">
                Repartidores
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>Ver todos</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {drivers.slice(0, 5).map((d) => {
                const loc = getDriverLocation(d.id);
                const isOnline = loc && new Date(loc.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;
                const activeCount = getDriverStopsCount(d.id);
                return (
                  <div key={d.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded cursor-pointer" onClick={() => navigate('/admin/users')}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-status-delivered' : 'bg-muted-foreground'}`} />
                    <span className="text-sm truncate flex-1">{d.full_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{activeCount} activas</Badge>
                  </div>
                );
              })}
              {drivers.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Sin repartidores</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateStopDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} drivers={drivers} shops={allUsers.filter(u => u.role === 'shop')} onSuccess={fetchData} />
      <StopDetailDialog stop={selectedStop} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} drivers={drivers} onUpdate={fetchData} shopName={selectedStop?.shop_name} />
    </div>
  );
}
