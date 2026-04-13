import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { CreateStopDialog } from '@/components/admin/CreateStopDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Stop, StopStatus } from '@/lib/supabase-types';
import { formatPrice } from '@/lib/pricing';
import { getDeliveryZone, adjustDistance } from '@/lib/delivery-zones';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Search, Package, Truck, CheckCircle, ListFilter, UserCheck, User, Store,
  CalendarIcon, X, ArrowUpDown, SlidersHorizontal, Euro, Route, Phone, DollarSign,
  LayoutList, LayoutGrid, Clock,
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'distance_asc' | 'distance_desc' | 'price_desc' | 'price_asc';
type PaymentFilter = 'all' | 'client_paid' | 'client_unpaid' | 'driver_paid' | 'driver_unpaid';

export default function AdminStops() {
  const { allStops, drivers, allUsers, loading, fetchData, getDriverById } = useAdminData();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | StopStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [selectedShopName, setSelectedShopName] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'cards'>('compact');

  const shopNames = useMemo(() => {
    const names = new Set(allStops.filter(s => s.shop_name).map(s => s.shop_name!));
    return Array.from(names).sort();
  }, [allStops]);

  const driversInStops = useMemo(() => {
    const ids = new Set(allStops.filter(s => s.driver_id).map(s => s.driver_id!));
    return drivers.filter(d => ids.has(d.id));
  }, [allStops, drivers]);

  const filteredStops = useMemo(() => {
    let result = [...allStops];

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (selectedDriverId !== 'all') {
      result = result.filter((s) => s.driver_id === selectedDriverId);
    }
    if (selectedShopName !== 'all') {
      result = result.filter((s) => s.shop_name === selectedShopName);
    }
    if (paymentFilter === 'client_paid') result = result.filter(s => s.paid_by_client);
    if (paymentFilter === 'client_unpaid') result = result.filter(s => !s.paid_by_client && s.status === 'delivered');
    if (paymentFilter === 'driver_paid') result = result.filter(s => s.paid_to_driver);
    if (paymentFilter === 'driver_unpaid') result = result.filter(s => !s.paid_to_driver && s.status === 'delivered');

    if (dateFrom || dateTo) {
      result = result.filter((s) => {
        const d = new Date(s.created_at);
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
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc': return a.client_name.localeCompare(b.client_name);
        case 'name_desc': return b.client_name.localeCompare(a.client_name);
        case 'distance_asc': return (a.distance_km ?? 999) - (b.distance_km ?? 999);
        case 'distance_desc': return (b.distance_km ?? 0) - (a.distance_km ?? 0);
        case 'price_desc': return (Number(b.price) || 0) - (Number(a.price) || 0);
        case 'price_asc': return (Number(a.price) || 0) - (Number(b.price) || 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [allStops, statusFilter, search, selectedDriverId, selectedShopName, paymentFilter, dateFrom, dateTo, sortBy]);

  // Financial summary of filtered
  const summary = useMemo(() => {
    const total = filteredStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
    const clientPaid = filteredStops.filter(s => s.paid_by_client).length;
    const clientUnpaid = filteredStops.filter(s => !s.paid_by_client && s.status === 'delivered').length;
    const driverPaid = filteredStops.filter(s => s.paid_to_driver).length;
    const driverUnpaid = filteredStops.filter(s => !s.paid_to_driver && s.status === 'delivered').length;
    return { total, clientPaid, clientUnpaid, driverPaid, driverUnpaid };
  }, [filteredStops]);

  const handleStopClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailDialogOpen(true);
  };

  const togglePayment = async (stopId: string, field: 'paid_by_client' | 'paid_to_driver', value: boolean) => {
    const atField = field === 'paid_by_client' ? 'paid_by_client_at' : 'paid_to_driver_at';
    const { error } = await supabase.from('stops').update({
      [field]: value,
      [atField]: value ? new Date().toISOString() : null,
    } as any).eq('id', stopId);
    if (error) { toast.error('Error al actualizar pago'); return; }
    toast.success(value ? 'Marcado como pagado' : 'Desmarcado');
    fetchData();
  };

  const clearFilters = () => {
    setSelectedDriverId('all');
    setSelectedShopName('all');
    setPaymentFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('newest');
    setSearch('');
    setStatusFilter('all');
  };

  const hasActiveFilters = selectedDriverId !== 'all' || selectedShopName !== 'all' || paymentFilter !== 'all' || dateFrom || dateTo || search || sortBy !== 'newest';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const counts = {
    all: allStops.length,
    pending: allStops.filter((s) => s.status === 'pending').length,
    assigned: allStops.filter((s) => s.status === 'assigned').length,
    picked: allStops.filter((s) => s.status === 'picked').length,
    delivered: allStops.filter((s) => s.status === 'delivered').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Todos los pedidos</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">
            {filteredStops.length} de {allStops.length} pedidos · Total: {formatPrice(summary.total)}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button variant={viewMode === 'compact' ? 'default' : 'ghost'} size="sm" className="rounded-r-none px-2" onClick={() => setViewMode('compact')}>
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" className="rounded-l-none px-2" onClick={() => setViewMode('cards')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* Payment summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPaymentFilter('all')}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{counts.all}</p>
            <p className="text-[10px] text-muted-foreground">Total pedidos</p>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", paymentFilter === 'client_paid' && "border-primary")} onClick={() => setPaymentFilter(paymentFilter === 'client_paid' ? 'all' : 'client_paid')}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-status-delivered">{summary.clientPaid}</p>
            <p className="text-[10px] text-muted-foreground">Cliente pagado</p>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", paymentFilter === 'client_unpaid' && "border-destructive")} onClick={() => setPaymentFilter(paymentFilter === 'client_unpaid' ? 'all' : 'client_unpaid')}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-destructive">{summary.clientUnpaid}</p>
            <p className="text-[10px] text-muted-foreground">Cliente pend.</p>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", paymentFilter === 'driver_paid' && "border-primary")} onClick={() => setPaymentFilter(paymentFilter === 'driver_paid' ? 'all' : 'driver_paid')}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-status-delivered">{summary.driverPaid}</p>
            <p className="text-[10px] text-muted-foreground">Repart. pagado</p>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", paymentFilter === 'driver_unpaid' && "border-destructive")} onClick={() => setPaymentFilter(paymentFilter === 'driver_unpaid' ? 'all' : 'driver_unpaid')}>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-destructive">{summary.driverUnpaid}</p>
            <p className="text-[10px] text-muted-foreground">Repart. pend.</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por cliente, dirección, referencia, tienda, teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList className="w-full overflow-x-auto flex justify-start sm:justify-center">
          <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm">Todos ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm">Pend. ({counts.pending})</TabsTrigger>
          <TabsTrigger value="assigned" className="gap-1 text-xs sm:text-sm">Asig. ({counts.assigned})</TabsTrigger>
          <TabsTrigger value="picked" className="gap-1 text-xs sm:text-sm">Rec. ({counts.picked})</TabsTrigger>
          <TabsTrigger value="delivered" className="gap-1 text-xs sm:text-sm">Entr. ({counts.delivered})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Advanced filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger><User className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Repartidor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los repartidores</SelectItem>
                  {driversInStops.map((d) => (<SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedShopName} onValueChange={setSelectedShopName}>
                <SelectTrigger><Store className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Tienda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {shopNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
                <SelectTrigger><DollarSign className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Pagos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los pagos</SelectItem>
                  <SelectItem value="client_paid">✅ Cliente pagado</SelectItem>
                  <SelectItem value="client_unpaid">❌ Cliente pendiente</SelectItem>
                  <SelectItem value="driver_paid">✅ Repartidor pagado</SelectItem>
                  <SelectItem value="driver_unpaid">❌ Repartidor pendiente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger><ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Ordenar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Más recientes</SelectItem>
                  <SelectItem value="oldest">Más antiguas</SelectItem>
                  <SelectItem value="price_desc">Mayor precio</SelectItem>
                  <SelectItem value="price_asc">Menor precio</SelectItem>
                  <SelectItem value="name_asc">Cliente A-Z</SelectItem>
                  <SelectItem value="distance_desc">Mayor distancia</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" /> Limpiar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {viewMode === 'compact' ? (
        <div className="border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_80px_70px_80px_80px_40px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <span>Cliente / Ref.</span>
            <span>Tienda</span>
            <span>Repartidor</span>
            <span>Estado</span>
            <span>Precio</span>
            <span className="text-center">Cli. pago</span>
            <span className="text-center">Rep. pago</span>
            <span></span>
          </div>
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {filteredStops.map((stop) => {
              const driver = getDriverById(stop.driver_id);
              return (
                <div
                  key={stop.id}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_80px_70px_80px_80px_40px] gap-2 px-3 py-2.5 hover:bg-muted/30 cursor-pointer items-center text-sm transition-colors"
                  onClick={() => handleStopClick(stop)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{stop.client_name}</span>
                      {stop.order_code && <span className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded shrink-0">{stop.order_code}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate sm:hidden">{stop.delivery_address}</p>
                  </div>
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">{stop.shop_name || '-'}</span>
                  <span className="text-xs truncate hidden sm:block">{driver?.full_name || <span className="text-muted-foreground">Sin asignar</span>}</span>
                  <div className="hidden sm:block"><StatusBadge status={stop.status} /></div>
                  <span className="text-xs font-semibold text-primary hidden sm:block">{stop.price != null ? formatPrice(Number(stop.price)) : '-'}</span>
                  <div className="hidden sm:flex justify-center" onClick={(e) => e.stopPropagation()}>
                    {stop.status === 'delivered' && (
                      <Checkbox
                        checked={stop.paid_by_client}
                        onCheckedChange={(v) => togglePayment(stop.id, 'paid_by_client', !!v)}
                        className={stop.paid_by_client ? 'data-[state=checked]:bg-status-delivered data-[state=checked]:border-status-delivered' : ''}
                      />
                    )}
                  </div>
                  <div className="hidden sm:flex justify-center" onClick={(e) => e.stopPropagation()}>
                    {stop.status === 'delivered' && (
                      <Checkbox
                        checked={stop.paid_to_driver}
                        onCheckedChange={(v) => togglePayment(stop.id, 'paid_to_driver', !!v)}
                        className={stop.paid_to_driver ? 'data-[state=checked]:bg-status-delivered data-[state=checked]:border-status-delivered' : ''}
                      />
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs hidden sm:block text-right">
                    {formatDistanceToNow(new Date(stop.created_at), { addSuffix: false, locale: es }).replace('hace ', '')}
                  </span>

                  {/* Mobile row info */}
                  <div className="flex items-center gap-2 flex-wrap sm:hidden col-span-full">
                    <StatusBadge status={stop.status} />
                    {stop.shop_name && <span className="text-[10px] text-muted-foreground">{stop.shop_name}</span>}
                    {driver && <span className="text-[10px]">{driver.full_name}</span>}
                    {stop.price != null && <span className="text-[10px] font-bold text-primary">{formatPrice(Number(stop.price))}</span>}
                    {stop.status === 'delivered' && (
                      <div className="flex gap-2 ml-auto" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center gap-1 text-[10px]">
                          <Checkbox checked={stop.paid_by_client} onCheckedChange={(v) => togglePayment(stop.id, 'paid_by_client', !!v)} className="w-3.5 h-3.5" />
                          Cli
                        </label>
                        <label className="flex items-center gap-1 text-[10px]">
                          <Checkbox checked={stop.paid_to_driver} onCheckedChange={(v) => togglePayment(stop.id, 'paid_to_driver', !!v)} className="w-3.5 h-3.5" />
                          Rep
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredStops.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto opacity-40 mb-2" />
              {hasActiveFilters ? 'Sin resultados con estos filtros' : 'No hay pedidos'}
            </div>
          )}
        </div>
      ) : (
        /* Card view - simpler cards */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStops.map((stop) => {
            const driver = getDriverById(stop.driver_id);
            return (
              <Card key={stop.id} className={cn("cursor-pointer card-hover border-l-4",
                stop.status === 'pending' && 'border-l-muted-foreground',
                stop.status === 'assigned' && 'border-l-status-assigned',
                stop.status === 'picked' && 'border-l-status-picked',
                stop.status === 'delivered' && 'border-l-status-delivered',
              )} onClick={() => handleStopClick(stop)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{stop.client_name}</span>
                    <StatusBadge status={stop.status} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="truncate">📍 {stop.delivery_address}</p>
                    {stop.shop_name && <p className="truncate">🏪 {stop.shop_name}</p>}
                    {driver && <p>🚴 {driver.full_name}</p>}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    {stop.price != null && <span className="font-bold text-primary">{formatPrice(Number(stop.price))}</span>}
                    {stop.order_code && <span className="font-mono text-[10px] bg-muted px-1 rounded">{stop.order_code}</span>}
                  </div>
                  {stop.status === 'delivered' && (
                    <div className="flex gap-3 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                      <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                        <Checkbox checked={stop.paid_by_client} onCheckedChange={(v) => togglePayment(stop.id, 'paid_by_client', !!v)} className="w-3.5 h-3.5" />
                        Cliente pagado
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                        <Checkbox checked={stop.paid_to_driver} onCheckedChange={(v) => togglePayment(stop.id, 'paid_to_driver', !!v)} className="w-3.5 h-3.5" />
                        Repart. pagado
                      </label>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredStops.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto opacity-40 mb-2" />
                {hasActiveFilters ? 'Sin resultados' : 'No hay pedidos'}
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
