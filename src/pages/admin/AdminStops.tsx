import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Stop, StopStatus } from '@/lib/supabase-types';
import { Plus, Search, Package, Truck, CheckCircle, ListFilter, UserCheck } from 'lucide-react';

export default function AdminStops() {
  const { stops, drivers, loading, fetchData, getDriverById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | StopStatus>('all');
  const [search, setSearch] = useState('');

  const filteredStops = useMemo(() => {
    let result = stops;
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.client_name.toLowerCase().includes(q) ||
          s.pickup_address.toLowerCase().includes(q) ||
          s.delivery_address.toLowerCase().includes(q)
      );
    }
    return result;
  }, [stops, statusFilter, search]);

  // Split into unassigned (pending) and the rest
  const unassignedStops = filteredStops.filter((s) => s.status === 'pending');
  const assignedStops = filteredStops.filter((s) => s.status !== 'pending');

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

  const counts = {
    all: stops.length,
    pending: stops.filter((s) => s.status === 'pending').length,
    assigned: stops.filter((s) => s.status === 'assigned').length,
    picked: stops.filter((s) => s.status === 'picked').length,
    delivered: stops.filter((s) => s.status === 'delivered').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paradas</h1>
          <p className="text-muted-foreground">Gestiona todas las paradas de reparto</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Nueva parada
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <ListFilter className="w-3.5 h-3.5" />
              Todas ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Sin asignar ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="assigned" className="gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Asignadas ({counts.assigned})
            </TabsTrigger>
            <TabsTrigger value="picked" className="gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Recogidas ({counts.picked})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Entregadas ({counts.delivered})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Show sections only when "all" filter is active */}
      {statusFilter === 'all' ? (
        <div className="space-y-6">
          {/* Unassigned section */}
          {unassignedStops.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                Sin repartidor asignado ({unassignedStops.length})
              </h2>
              <div className="space-y-3 p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30">
                {unassignedStops.map((stop) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    driver={getDriverById(stop.driver_id)}
                    onClick={() => handleStopClick(stop)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Assigned / in progress section */}
          {assignedStops.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" />
                En proceso ({assignedStops.length})
              </h2>
              <div className="space-y-3">
                {assignedStops.map((stop) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    driver={getDriverById(stop.driver_id)}
                    onClick={() => handleStopClick(stop)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredStops.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {search ? 'No se encontraron paradas' : 'No hay paradas'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Flat list when a specific filter is selected */
        <div className="space-y-3">
          {filteredStops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              driver={getDriverById(stop.driver_id)}
              onClick={() => handleStopClick(stop)}
            />
          ))}
          {filteredStops.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {search ? 'No se encontraron paradas' : 'No hay paradas con este filtro'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CreateStopDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} drivers={drivers} onSuccess={fetchData} />
      <StopDetailDialog stop={selectedStop} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} drivers={drivers} onUpdate={fetchData} />
    </div>
  );
}
