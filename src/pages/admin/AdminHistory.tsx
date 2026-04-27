import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Stop } from '@/lib/supabase-types';
import { Search, History, Package, Download, CalendarIcon, User, X, Store, ArrowUpDown, SlidersHorizontal, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { stopsApi } from '@/lib/api';
import { toast } from 'sonner';

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'distance_asc' | 'distance_desc';

const PAGE_SIZE = 30;

export default function AdminHistory() {
  const { allStops, drivers, loading, fetchData, getDriverById } = useAdminData({ poll: false });
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [selectedShopName, setSelectedShopName] = useState<string>('all');
  const [selectedPackageSize, setSelectedPackageSize] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleting, setDeleting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const historyStops = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const isExpiredOrDone = (s: Stop) =>
      s.status === 'delivered' ||
      (s.scheduled_pickup_at && new Date(s.scheduled_pickup_at) < todayStart && s.status !== 'picked');

    let result = allStops.filter((s) => isExpiredOrDone(s));

    if (selectedDriverId !== 'all') result = result.filter((s) => s.driver_id === selectedDriverId);
    if (selectedShopName !== 'all') result = result.filter((s) => s.shop_name === selectedShopName);
    if (selectedPackageSize !== 'all') result = result.filter((s) => s.package_size === selectedPackageSize);
    if (selectedStatus !== 'all') result = result.filter((s) => s.status === selectedStatus);

    if (dateFrom || dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.delivered_at || s.scheduled_pickup_at || s.updated_at);
        if (dateFrom && dateTo) return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
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
          (s.order_code && s.order_code.toLowerCase().includes(q)) ||
          (s.shop_name && s.shop_name.toLowerCase().includes(q)) ||
          (s.client_phone && s.client_phone.includes(q))
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.delivered_at || a.scheduled_pickup_at || a.updated_at).getTime();
      const dateB = new Date(b.delivered_at || b.scheduled_pickup_at || b.updated_at).getTime();
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
  }, [allStops, search, dateFrom, dateTo, selectedDriverId, selectedShopName, selectedPackageSize, selectedStatus, sortBy]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, dateFrom, dateTo, selectedDriverId, selectedShopName, selectedPackageSize, selectedStatus, sortBy]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < historyStops.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, historyStops.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, historyStops.length]);

  const visibleStops = useMemo(() => historyStops.slice(0, visibleCount), [historyStops, visibleCount]);

  const driversInHistory = useMemo(() => {
    const ids = new Set(allStops.filter(s => s.driver_id).map(s => s.driver_id!));
    return drivers.filter(d => ids.has(d.id));
  }, [allStops, drivers]);

  const shopNamesInHistory = useMemo(() => {
    const names = new Set(allStops.filter(s => s.shop_name).map(s => s.shop_name!));
    return Array.from(names).sort();
  }, [allStops]);

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedDriverId('all');
    setSelectedShopName('all');
    setSelectedPackageSize('all');
    setSelectedStatus('all');
    setSortBy('newest');
    setSearch('');
  };

  const hasActiveFilters = selectedDriverId !== 'all' || selectedShopName !== 'all' || selectedPackageSize !== 'all' || selectedStatus !== 'all' || dateFrom || dateTo || search || sortBy !== 'newest';

  const deleteFilteredHistory = useCallback(async () => {
    if (historyStops.length === 0) return;
    setDeleting(true);
    try {
      const stopIds = historyStops.map((s) => s.id);
      // Backend DELETE /api/stops/:id also removes associated photos
      for (const id of stopIds) {
        await stopsApi.delete(id);
      }
      toast.success(`${stopIds.length} registros eliminados del historial`);
      fetchData();
    } catch (error: any) {
      toast.error('Error al eliminar', { description: error.message });
    } finally {
      setDeleting(false);
    }
  }, [historyStops, fetchData]);

  const exportCSV = () => {
    if (historyStops.length === 0) return;
    const headers = [
      'Referencia', 'Tienda', 'Cliente', 'Teléfono', 'Dirección Recogida', 'Dirección Entrega',
      'Hora Recogida', 'Hora Entrega', 'Repartidor', 'Distancia (km)', 'Tamaño', 'Notas'
    ];
    const rows = historyStops.map((s) => {
      const driver = getDriverById(s.driver_id);
      return [
        s.order_code || '',
        s.shop_name || '',
        s.client_name,
        s.client_phone || '',
        `"${s.pickup_address.replace(/"/g, '""')}"`,
        `"${s.delivery_address.replace(/"/g, '""')}"`,
        s.picked_at ? format(new Date(s.picked_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
        s.delivered_at ? format(new Date(s.delivered_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
        driver?.full_name || 'No asignado',
        s.distance_km?.toFixed(1) || '',
        s.package_size || '',
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
            {selectedShopName !== 'all' && ` · ${selectedShopName}`}
            {selectedDriverId !== 'all' && ` · ${driversInHistory.find(d => d.id === selectedDriverId)?.full_name}`}
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
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={historyStops.length === 0} className="shrink-0">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={historyStops.length === 0 || deleting} className="shrink-0">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : <Trash2 className="w-4 h-4 sm:mr-2" />}
                <span className="hidden sm:inline">{deleting ? 'Borrando...' : 'Borrar'}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar historial?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente <strong>{historyStops.length} registros</strong>
                  {hasActiveFilters ? ' que coinciden con los filtros actuales' : ' del historial completo'},
                  incluyendo sus fotos de prueba de entrega. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteFilteredHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Borrar {historyStops.length} registros
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, dirección, referencia, tienda, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
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

              <Select value={selectedShopName} onValueChange={setSelectedShopName}>
                <SelectTrigger>
                  <Store className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {shopNamesInHistory.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPackageSize} onValueChange={setSelectedPackageSize}>
                <SelectTrigger>
                  <Package className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tamaños</SelectItem>
                  <SelectItem value="small">📦 Pequeño</SelectItem>
                  <SelectItem value="medium">📦 Mediano</SelectItem>
                  <SelectItem value="large">📦 Grande</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="pending">Pendiente (expirado)</SelectItem>
                  <SelectItem value="assigned">Asignado (expirado)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger>
                  <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
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
                  <Button variant="outline" className={cn("justify-start flex-1", dateFrom ? 'text-foreground' : 'text-muted-foreground')}>
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
                  <Button variant="outline" className={cn("justify-start flex-1", dateTo ? 'text-foreground' : 'text-muted-foreground')}>
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

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                  <X className="w-4 h-4 mr-1" /> Limpiar todo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {visibleStops.map((stop) => (
          <StopCard
            key={stop.id}
            stop={stop}
            driver={getDriverById(stop.driver_id)}
            shopName={stop.shop_name}
            onClick={() => { setSelectedStop(stop); setDetailDialogOpen(true); }}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {visibleCount < historyStops.length && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

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
