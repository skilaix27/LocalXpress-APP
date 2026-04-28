import { useState, useMemo, useEffect } from 'react';
import { useShopData } from '@/hooks/useShopData';
import { ShopStopCard } from '@/components/shop/ShopStopCard';
import { ShopStopDetailDialog } from '@/components/shop/ShopStopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package, Download, CalendarIcon, X, ArrowUpDown, SlidersHorizontal, Archive } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { archivedStopsApi, fetchAllPages } from '@/lib/api';

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'distance_asc' | 'distance_desc';

export default function ShopHistory() {
  const { deliveredStops: activeDelivered } = useShopData({ poll: false });
  const [archivedStops, setArchivedStops] = useState<Stop[]>([]);

  useEffect(() => {
    fetchAllPages<Stop>((page) =>
      archivedStopsApi.list({ page, limit: 100 }) as Promise<{ data: Stop[]; total: number; totalPages: number }>
    ).then(setArchivedStops).catch(() => {});
  }, []);

  const historyStops = useMemo(() => {
    const activeIds = new Set(activeDelivered.map((s) => s.id));
    return [...activeDelivered, ...archivedStops.filter((s) => !activeIds.has(s.id))];
  }, [activeDelivered, archivedStops]);

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedPackageSize, setSelectedPackageSize] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...historyStops];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.client_name.toLowerCase().includes(q) ||
          s.pickup_address.toLowerCase().includes(q) ||
          s.delivery_address.toLowerCase().includes(q) ||
          (s.order_code && s.order_code.toLowerCase().includes(q)) ||
          (s.client_phone && s.client_phone.includes(q))
      );
    }
    if (selectedPackageSize !== 'all') {
      result = result.filter(s => s.package_size === selectedPackageSize);
    }
    if (dateFrom || dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.delivered_at || s.updated_at);
        if (dateFrom && dateTo) return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        if (dateFrom) return d >= startOfDay(dateFrom);
        if (dateTo) return d <= endOfDay(dateTo);
        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(a.delivered_at || a.updated_at).getTime();
      const dateB = new Date(b.delivered_at || b.updated_at).getTime();
      switch (sortBy) {
        case 'oldest': return dateA - dateB;
        case 'name_asc': return a.client_name.localeCompare(b.client_name);
        case 'name_desc': return b.client_name.localeCompare(a.client_name);
        case 'distance_asc': return (a.distance_km ?? 999) - (b.distance_km ?? 999);
        case 'distance_desc': return (b.distance_km ?? 0) - (a.distance_km ?? 0);
        default: return dateB - dateA;
      }
    });

    return result;
  }, [historyStops, search, dateFrom, dateTo, selectedPackageSize, sortBy]);

  const hasActiveFilters = search || dateFrom || dateTo || selectedPackageSize !== 'all' || sortBy !== 'newest';

  const clearFilters = () => {
    setSearch('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedPackageSize('all');
    setSortBy('newest');
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Referencia', 'Cliente', 'Teléfono', 'Dirección Recogida', 'Dirección Entrega', 'Hora Entrega', 'Distancia (km)', 'Tamaño'];
    const rows = filtered.map((s) => [
      s.order_code || '',
      s.client_name,
      s.client_phone || '',
      `"${s.pickup_address.replace(/"/g, '""')}"`,
      `"${s.delivery_address.replace(/"/g, '""')}"`,
      s.delivered_at ? format(new Date(s.delivered_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
      s.distance_km?.toFixed(1) || '',
      s.package_size || '',
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
          <p className="text-muted-foreground text-sm">
            {filtered.length}{hasActiveFilters ? ` de ${historyStops.length}` : ''} entregas
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="shrink-0">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, dirección, referencia, teléfono..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Package size */}
              <Select value={selectedPackageSize} onValueChange={setSelectedPackageSize}>
                <SelectTrigger className="text-xs">
                  <Package className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tamaños</SelectItem>
                  <SelectItem value="small">📦 Pequeño</SelectItem>
                  <SelectItem value="medium">📦 Mediano</SelectItem>
                  <SelectItem value="large">📦 Grande</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Más recientes</SelectItem>
                  <SelectItem value="oldest">Más antiguas</SelectItem>
                  <SelectItem value="name_asc">Cliente A-Z</SelectItem>
                  <SelectItem value="name_desc">Cliente Z-A</SelectItem>
                  <SelectItem value="distance_asc">Menor distancia</SelectItem>
                  <SelectItem value="distance_desc">Mayor distancia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start flex-1", dateFrom ? 'text-foreground' : 'text-muted-foreground')}>
                    <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: es }) : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={es} initialFocus className="p-3 pointer-events-auto" />
                  {dateFrom && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateFrom(undefined)}>Limpiar</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start flex-1", dateTo ? 'text-foreground' : 'text-muted-foreground')}>
                    <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: es }) : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={es} initialFocus className="p-3 pointer-events-auto" />
                  {dateTo && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateTo(undefined)}>Limpiar</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
                <X className="w-3.5 h-3.5 mr-1" /> Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((stop) => (
          <div key={stop.id} className="relative">
            {stop.is_archived && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted border rounded-full px-2 py-0.5">
                <Archive className="w-3 h-3" /> Archivado
              </div>
            )}
            <ShopStopCard stop={stop} onClick={() => { setSelectedStop(stop); setDetailOpen(true); }} />
          </div>
        ))}
        {filtered.length === 0 && (
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

      <ShopStopDetailDialog stop={selectedStop} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
