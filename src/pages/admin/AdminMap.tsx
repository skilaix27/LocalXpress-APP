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
      <div className="p-3 sm:p-4 border-b bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-base sm:text-lg font-bold">Mapa</h1>
          <Badge variant="secondary" className="text-xs">{filteredStops.length}</Badge>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="h-8 sm:h-9 w-full sm:w-auto">
            <TabsTrigger value="active" className="text-xs gap-1 px-2 sm:px-3 flex-1 sm:flex-none">
              <Eye className="w-3 h-3" /> Act.
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs gap-1 px-2 sm:px-3 flex-1 sm:flex-none">
              <Package className="w-3 h-3" /> Pend.
            </TabsTrigger>
            <TabsTrigger value="picked" className="text-xs gap-1 px-2 sm:px-3 flex-1 sm:flex-none">
              <Truck className="w-3 h-3" /> Rec.
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs gap-1 px-2 sm:px-3 flex-1 sm:flex-none">
              Todas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Full-height map */}
      <div className="flex-1 relative">
        <DeliveryMap
          stops={filteredStops}
          driverLocations={driverLocations
            .filter((loc) => new Date(loc.updated_at).getTime() > Date.now() - 5 * 60 * 1000)
            .map((loc) => ({
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
