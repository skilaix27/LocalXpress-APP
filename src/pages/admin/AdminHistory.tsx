import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package } from 'lucide-react';

export default function AdminHistory() {
  const { allStops, drivers, loading, fetchData, getDriverById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Only delivered stops (full history)
  const deliveredStops = useMemo(() => {
    let result = allStops.filter((s) => s.status === 'delivered');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.client_name.toLowerCase().includes(q) ||
          s.pickup_address.toLowerCase().includes(q) ||
          s.delivery_address.toLowerCase().includes(q) ||
          (s.order_code && s.order_code.toLowerCase().includes(q))
      );
    }
    // Sort by delivered_at descending
    return result.sort(
      (a, b) => new Date(b.delivered_at || b.updated_at).getTime() - new Date(a.delivered_at || a.updated_at).getTime()
    );
  }, [allStops, search]);

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6" />
            Historial de entregas
          </h1>
          <p className="text-muted-foreground">
            {deliveredStops.length} entregas completadas en total
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {deliveredStops.map((stop) => (
          <StopCard
            key={stop.id}
            stop={stop}
            driver={getDriverById(stop.driver_id)}
            onClick={() => handleStopClick(stop)}
          />
        ))}
        {deliveredStops.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {search ? 'No se encontraron entregas' : 'No hay entregas completadas aún'}
              </p>
            </CardContent>
          </Card>
        )}
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
