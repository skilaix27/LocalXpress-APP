import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Stop, StopStatus } from '@/lib/supabase-types';
import { MapPin, Package, Truck, CheckCircle, Eye } from 'lucide-react';

export default function AdminMap() {
  const { stops, drivers, driverLocations, loading, fetchData, getDriverById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | StopStatus>('active');

  const filteredStops = (() => {
    if (filter === 'active') return stops.filter((s) => s.status !== 'delivered');
    if (filter === 'all') return stops;
    return stops.filter((s) => s.status === filter);
  })();

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
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="p-4 border-b bg-card flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Mapa de reparto</h1>
          <Badge variant="secondary">{filteredStops.length} paradas</Badge>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="h-9">
            <TabsTrigger value="active" className="text-xs gap-1">
              <Eye className="w-3.5 h-3.5" /> Activas
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs gap-1">
              <Package className="w-3.5 h-3.5" /> Pendientes
            </TabsTrigger>
            <TabsTrigger value="picked" className="text-xs gap-1">
              <Truck className="w-3.5 h-3.5" /> Recogidas
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Todas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Full-height map */}
      <div className="flex-1 relative">
        <DeliveryMap
          stops={filteredStops}
          driverLocations={driverLocations.map((loc) => ({
            ...loc,
            driver: getDriverById(loc.driver_id) || undefined,
          }))}
          selectedStopId={selectedStop?.id}
          onStopClick={handleStopClick}
        />
      </div>

      <StopDetailDialog
        stop={selectedStop}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        drivers={drivers}
        onUpdate={fetchData}
      />
    </div>
  );
}
