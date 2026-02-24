import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  const exportCSV = () => {
    if (deliveredStops.length === 0) return;
    const headers = [
      'Referencia', 'Cliente', 'Teléfono', 'Dirección Recogida', 'Dirección Entrega',
      'Hora Recogida', 'Hora Entrega', 'Repartidor', 'Distancia (km)', 'Notas'
    ];
    const rows = deliveredStops.map((s) => {
      const driver = getDriverById(s.driver_id);
      return [
        s.order_code || '',
        s.client_name,
        s.client_phone || '',
        `"${s.pickup_address.replace(/"/g, '""')}"`,
        `"${s.delivery_address.replace(/"/g, '""')}"`,
        s.picked_at ? format(new Date(s.picked_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
        s.delivered_at ? format(new Date(s.delivered_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
        driver?.full_name || 'No asignado',
        s.distance_km?.toFixed(1) || '',
        `"${(s.client_notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entregas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6" />
            Historial
          </h1>
          <p className="text-muted-foreground text-sm">
            {deliveredStops.length} entregas completadas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={deliveredStops.length === 0} className="shrink-0">
          <Download className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      <div className="relative">
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
