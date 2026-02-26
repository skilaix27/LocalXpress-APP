import { useState, useMemo } from 'react';
import { useShopData } from '@/hooks/useShopData';
import { ShopStopCard } from '@/components/shop/ShopStopCard';
import { ShopStopDetailDialog } from '@/components/shop/ShopStopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ShopHistory() {
  const { deliveredStops: historyStops } = useShopData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = [...historyStops];
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
    return result.sort(
      (a, b) => new Date(b.delivered_at || b.updated_at).getTime() - new Date(a.delivered_at || a.updated_at).getTime()
    );
  }, [historyStops, search]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Referencia', 'Cliente', 'Teléfono', 'Dirección Recogida', 'Dirección Entrega', 'Hora Entrega', 'Distancia (km)'];
    const rows = filtered.map((s) => [
      s.order_code || '',
      s.client_name,
      s.client_phone || '',
      `"${s.pickup_address.replace(/"/g, '""')}"`,
      `"${s.delivery_address.replace(/"/g, '""')}"`,
      s.delivered_at ? format(new Date(s.delivered_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
      s.distance_km?.toFixed(1) || '',
    ].join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-entregas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6" /> Historial
          </h1>
          <p className="text-muted-foreground text-sm">{filtered.length} entregas completadas</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="shrink-0">
          <Download className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, dirección..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((stop) => (
          <ShopStopCard key={stop.id} stop={stop} onClick={() => { setSelectedStop(stop); setDetailOpen(true); }} />
        ))}
        {filtered.length === 0 && (
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

      <ShopStopDetailDialog stop={selectedStop} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
