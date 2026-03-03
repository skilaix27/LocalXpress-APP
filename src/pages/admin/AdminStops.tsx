import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopCard } from '@/components/admin/StopCard';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { Stop, StopStatus } from '@/lib/supabase-types';
import { Plus, Search, Package, Truck, CheckCircle, ListFilter, UserCheck, User, Store, CalendarIcon, X, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPackageSizeLabel } from '@/lib/package-size';

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'distance_asc' | 'distance_desc';

export default function AdminStops() {
  const { stops, drivers, allUsers, loading, fetchData, getDriverById, getShopById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | StopStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [selectedShopName, setSelectedShopName] = useState('all');
  const [selectedPackageSize, setSelectedPackageSize] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Unique shop names and drivers in active stops
  const shopNames = useMemo(() => {
    const names = new Set(stops.filter(s => s.shop_name).map(s => s.shop_name!));
    return Array.from(names).sort();
  }, [stops]);

  const driversInStops = useMemo(() => {
    const ids = new Set(stops.filter(s => s.driver_id).map(s => s.driver_id!));
    return drivers.filter(d => ids.has(d.id));
  }, [stops, drivers]);

  const filteredStops = useMemo(() => {
    let result = [...stops];

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (selectedDriverId !== 'all') {
      result = result.filter((s) => s.driver_id === selectedDriverId);
    }
    if (selectedShopName !== 'all') {
      result = result.filter((s) => s.shop_name === selectedShopName);
    }
    if (selectedPackageSize !== 'all') {
      result = result.filter((s) => s.package_size === selectedPackageSize);
    }
    if (dateFrom || dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.scheduled_pickup_at || s.created_at);
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

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc': return a.client_name.localeCompare(b.client_name);
        case 'name_desc': return b.client_name.localeCompare(a.client_name);
        case 'distance_asc': return (a.distance_km ?? 999) - (b.distance_km ?? 999);
        case 'distance_desc': return (b.distance_km ?? 0) - (a.distance_km ?? 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [stops, statusFilter, search, selectedDriverId, selectedShopName, selectedPackageSize, dateFrom, dateTo, sortBy]);

  const unassignedStops = filteredStops.filter((s) => s.status === 'pending');
  const assignedStops = filteredStops.filter((s) => s.status !== 'pending');

  const handleStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSelectedDriverId('all');
    setSelectedShopName('all');
    setSelectedPackageSize('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('newest');
    setSearch('');
    setStatusFilter('all');
  };

  const hasActiveFilters = selectedDriverId !== 'all' || selectedShopName !== 'all' || selectedPackageSize !== 'all' || dateFrom || dateTo || search || sortBy !== 'newest';

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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Paradas</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">
            {filteredStops.length} de {stops.length} paradas
            {selectedShopName !== 'all' && ` · ${selectedShopName}`}
            {selectedDriverId !== 'all' && ` · ${driversInStops.find(d => d.id === selectedDriverId)?.full_name}`}
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
          <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Nueva parada</span>
          </Button>
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

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList className="w-full overflow-x-auto flex justify-start sm:justify-center">
          <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm sm:gap-1.5">
            <ListFilter className="w-3.5 h-3.5 hidden sm:block" />
            Todas ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm sm:gap-1.5">
            <Package className="w-3.5 h-3.5 hidden sm:block" />
            Pend. ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="assigned" className="gap-1 text-xs sm:text-sm sm:gap-1.5">
            <UserCheck className="w-3.5 h-3.5 hidden sm:block" />
            Asig. ({counts.assigned})
          </TabsTrigger>
          <TabsTrigger value="picked" className="gap-1 text-xs sm:text-sm sm:gap-1.5">
            <Truck className="w-3.5 h-3.5 hidden sm:block" />
            Rec. ({counts.picked})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-1 text-xs sm:text-sm sm:gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 hidden sm:block" />
            Entr. ({counts.delivered})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Advanced filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Driver */}
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <User className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Repartidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los repartidores</SelectItem>
                  {driversInStops.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Shop */}
              <Select value={selectedShopName} onValueChange={setSelectedShopName}>
                <SelectTrigger>
                  <Store className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {shopNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Package size */}
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

              {/* Sort */}
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

      {/* Show sections only when "all" filter is active */}
      {statusFilter === 'all' ? (
        <div className="space-y-6">
          {unassignedStops.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                Sin repartidor asignado ({unassignedStops.length})
              </h2>
              <div className="space-y-3 p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30">
                {unassignedStops.map((stop) => (
                  <StopCard key={stop.id} stop={stop} driver={getDriverById(stop.driver_id)} shopName={stop.shop_name} onClick={() => handleStopClick(stop)} />
                ))}
              </div>
            </div>
          )}

          {assignedStops.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" />
                En proceso ({assignedStops.length})
              </h2>
              <div className="space-y-3">
                {assignedStops.map((stop) => (
                  <StopCard key={stop.id} stop={stop} driver={getDriverById(stop.driver_id)} shopName={stop.shop_name} onClick={() => handleStopClick(stop)} />
                ))}
              </div>
            </div>
          )}

          {filteredStops.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? 'No se encontraron paradas con estos filtros' : 'No hay paradas'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStops.map((stop) => (
            <StopCard key={stop.id} stop={stop} driver={getDriverById(stop.driver_id)} shopName={getShopById(stop.shop_id)?.shop_name} onClick={() => handleStopClick(stop)} />
          ))}
          {filteredStops.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? 'No se encontraron paradas con estos filtros' : 'No hay paradas con este filtro'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CreateStopDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} drivers={drivers} shops={allUsers.filter(u => u.role === 'shop')} onSuccess={fetchData} />
      <StopDetailDialog stop={selectedStop} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} drivers={drivers} onUpdate={fetchData} shopName={selectedStop?.shop_name} />
    </div>
  );
}
