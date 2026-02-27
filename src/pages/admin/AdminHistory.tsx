import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package, Download, CalendarIcon, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function AdminHistory() {
  const { allStops, drivers, loading, fetchData, getDriverById, getShopById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');

  // History: delivered + expired
  const historyStops = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const isExpiredOrDone = (s: Stop) =>
      s.status === 'delivered' ||
      (s.scheduled_pickup_at && new Date(s.scheduled_pickup_at) < todayStart && s.status !== 'picked');

    let result = allStops.filter((s) => isExpiredOrDone(s));

    // Filter by driver
    if (selectedDriverId !== 'all') {
      result = result.filter((s) => s.driver_id === selectedDriverId);
    }

    // Filter by single date
    if (selectedDate && !dateFrom && !dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.delivered_at || s.scheduled_pickup_at || s.updated_at);
        return isSameDay(d, selectedDate);
      });
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.delivered_at || s.scheduled_pickup_at || s.updated_at);
        if (dateFrom && dateTo) {
          return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        }
        if (dateFrom) return d >= startOfDay(dateFrom);
        if (dateTo) return d <= endOfDay(dateTo);
        return true;
      });
    }

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
      (a, b) => new Date(b.delivered_at || b.scheduled_pickup_at || b.updated_at).getTime() - new Date(a.delivered_at || a.scheduled_pickup_at || a.updated_at).getTime()
    );
  }, [allStops, search, selectedDate, dateFrom, dateTo, selectedDriverId]);

  // Drivers that appear in history
  const driversInHistory = useMemo(() => {
    const ids = new Set(allStops.filter(s => s.driver_id).map(s => s.driver_id!));
    return drivers.filter(d => ids.has(d.id));
  }, [allStops, drivers]);

  const handleStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSelectedDate(undefined);
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedDriverId('all');
    setSearch('');
  };

  const hasActiveFilters = selectedDriverId !== 'all' || selectedDate || dateFrom || dateTo || search;

  const exportCSV = () => {
    if (historyStops.length === 0) return;
    const headers = [
      'Referencia', 'Cliente', 'Teléfono', 'Dirección Recogida', 'Dirección Entrega',
      'Hora Recogida', 'Hora Entrega', 'Repartidor', 'Distancia (km)', 'Notas'
    ];
    const rows = historyStops.map((s) => {
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
            {historyStops.length} registros
            {selectedDriverId !== 'all' && ` · ${driversInHistory.find(d => d.id === selectedDriverId)?.full_name}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={historyStops.length === 0} className="shrink-0">
          <Download className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Driver filter */}
        <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
          <SelectTrigger className="sm:w-[200px]">
            <User className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Repartidor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los repartidores</SelectItem>
            {driversInHistory.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" className={cn("justify-start sm:w-[160px]", dateFrom ? 'text-foreground' : 'text-muted-foreground')}>
              <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
              {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: es }) : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => { setDateFrom(d); setSelectedDate(undefined); }}
              locale={es}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {dateFrom && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateFrom(undefined)}>Limpiar</Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" className={cn("justify-start sm:w-[160px]", dateTo ? 'text-foreground' : 'text-muted-foreground')}>
              <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
              {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: es }) : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => { setDateTo(d); setSelectedDate(undefined); }}
              locale={es}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {dateTo && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateTo(undefined)}>Limpiar</Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0" title="Limpiar filtros">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, dirección, referencia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {historyStops.map((stop) => (
          <StopCard
            key={stop.id}
            stop={stop}
            driver={getDriverById(stop.driver_id)}
            shopName={stop.shop_name}
            onClick={() => handleStopClick(stop)}
          />
        ))}
        {historyStops.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'No se encontraron entregas con estos filtros' : 'No hay entregas completadas aún'}
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
        shopName={selectedStop?.shop_name}
      />
    </div>
  );
}