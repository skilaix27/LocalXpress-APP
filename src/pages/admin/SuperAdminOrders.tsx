import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  superadminApi, profilesApi, zonesApi,
  SuperAdminStop, SuperAdminStopsParams,
  BulkPaymentAction, getToken,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck, Package, Search, Download, RefreshCw,
  SlidersHorizontal, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const ORDER_TYPE_LABELS: Record<string, string> = {
  business: 'Empresa',
  individual: 'Particular',
};

const SOURCE_LABELS: Record<string, string> = {
  app: 'App',
  email: 'Email',
  api: 'API',
  whatsapp: 'WhatsApp',
  individual_web: 'Particular web',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid:   { label: 'No pagado',  color: 'text-muted-foreground' },
  pending:  { label: 'Pendiente',  color: 'text-orange-500' },
  paid:     { label: 'Pagado',     color: 'text-emerald-600' },
  failed:   { label: 'Fallido',    color: 'text-red-500' },
  refunded: { label: 'Reembolsado', color: 'text-blue-500' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricingZone {
  id: string;
  name: string;
  min_km: number;
  max_km: number | null;
  fixed_price: number | null;
  per_km_price: number | null;
}

interface ShopOrDriver {
  id: string;
  full_name: string;
  shop_name: string | null;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending:   { label: 'Sin asignar', variant: 'secondary' },
  assigned:  { label: 'Asignado',    variant: 'outline' },
  picked:    { label: 'Recogido',    variant: 'default' },
  delivered: { label: 'Entregado',   variant: 'default' },
  cancelled: { label: 'Cancelado',   variant: 'destructive' },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'd MMM yy', { locale: es }); }
  catch { return '—'; }
}

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function getZoneName(distanceKm: number | null | undefined, zones: PricingZone[]): string {
  if (distanceKm == null || zones.length === 0) return '—';
  const MARGIN = 0.15;
  const adj = distanceKm + MARGIN;
  const zone = zones.find((z) => adj > z.min_km && (z.max_km == null || adj <= z.max_km));
  return zone?.name ?? '—';
}

function effectivePriceDriver(stop: SuperAdminStop): number | null {
  if (stop.price_driver != null) return stop.price_driver;
  if (stop.price != null) return Math.round(stop.price * 0.70 * 100) / 100;
  return null;
}

function effectiveMargin(stop: SuperAdminStop): number | null {
  if (stop.price == null) return null;
  const pd = effectivePriceDriver(stop);
  if (pd == null) return null;
  return Math.round((stop.price - pd) * 100) / 100;
}

function serviceDate(stop: SuperAdminStop): string {
  return fmtDate(stop.scheduled_pickup_at ?? stop.created_at);
}

// ─── Sub-nav shared across superadmin pages ────────────────────────────────────

export function SuperAdminNav() {
  const baseClass = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';
  const activeClass = 'border-primary text-foreground';
  const inactiveClass = 'border-transparent text-muted-foreground hover:text-foreground';

  return (
    <nav className="flex gap-0 border-b mb-6 overflow-x-auto">
      <NavLink
        to="/admin/superadmin"
        end
        className={({ isActive }) => cn(baseClass, isActive ? activeClass : inactiveClass)}
      >
        Resumen
      </NavLink>
      <NavLink
        to="/admin/superadmin/orders"
        className={({ isActive }) => cn(baseClass, isActive ? activeClass : inactiveClass)}
      >
        Pedidos
      </NavLink>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 30;

// Use '_all' sentinel instead of '' to avoid Radix UI SelectItem crash on empty value
interface Filters {
  search: string;
  status: string;
  archived: string;
  shop_id: string;
  driver_id: string;
  date_from: string;
  date_to: string;
  paid_by_client: string;
  paid_to_driver: string;
  order_type: string;
  source: string;
  payment_status: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  status: 'all',
  archived: 'all',
  shop_id: '_all',
  driver_id: '_all',
  date_from: '',
  date_to: '',
  paid_by_client: 'all',
  paid_to_driver: 'all',
  order_type: 'all',
  source: 'all',
  payment_status: 'all',
};

export default function SuperAdminOrders() {
  const { toast } = useToast();

  // ─── Data state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SuperAdminStop[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState({ total_price: 0, total_price_driver: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── UI state ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ─── Reference data ──────────────────────────────────────────────────────
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [shops, setShops] = useState<ShopOrDriver[]>([]);
  const [drivers, setDrivers] = useState<ShopOrDriver[]>([]);

  useEffect(() => {
    zonesApi.list().then((z) => setZones(z as PricingZone[])).catch(() => {});
    profilesApi.listAll('shop').then((s) => setShops(s as ShopOrDriver[])).catch(() => {});
    profilesApi.listAll('driver').then((d) => setDrivers(d as ShopOrDriver[])).catch(() => {});
  }, []);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const buildParams = useCallback((f: Filters, p: number): SuperAdminStopsParams => {
    const params: SuperAdminStopsParams = { page: p, limit: LIMIT };
    if (f.search)                   params.search = f.search;
    if (f.status !== 'all')         params.status = f.status;
    // archived: 'all' means both, 'false' means active only, 'true' means archived only
    params.archived = f.archived;
    // '_all' sentinel means no filter
    if (f.shop_id && f.shop_id !== '_all')     params.shop_id = f.shop_id;
    if (f.driver_id && f.driver_id !== '_all') params.driver_id = f.driver_id;
    if (f.date_from)                params.date_from = f.date_from;
    if (f.date_to)                  params.date_to = f.date_to;
    if (f.paid_by_client !== 'all') params.paid_by_client = f.paid_by_client;
    if (f.paid_to_driver !== 'all') params.paid_to_driver = f.paid_to_driver;
    if (f.order_type !== 'all')     params.order_type = f.order_type;
    if (f.source !== 'all')         params.source = f.source;
    if (f.payment_status !== 'all') params.payment_status = f.payment_status;
    return params;
  }, []);

  const fetchData = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const result = await superadminApi.getStops(buildParams(f, p));
      setData(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchData(DEFAULT_FILTERS, 1); }, []); // eslint-disable-line

  const applyFilters = () => {
    setFilters(pendingFilters);
    setPage(1);
    fetchData(pendingFilters, 1);
  };

  const clearFilters = () => {
    setPendingFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    fetchData(DEFAULT_FILTERS, 1);
  };

  const goToPage = (p: number) => {
    setPage(p);
    fetchData(filters, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Selection ───────────────────────────────────────────────────────────
  const activeStopsOnPage = data.filter((s) => !s.is_archived);
  const allPageSelected =
    activeStopsOnPage.length > 0 &&
    activeStopsOnPage.every((s) => selected.has(s.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        activeStopsOnPage.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        activeStopsOnPage.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const toggleRow = (id: string, isArchived: boolean) => {
    if (isArchived) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Bulk actions ────────────────────────────────────────────────────────
  const runBulkAction = async (action: BulkPaymentAction) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await superadminApi.bulkUpdatePayments(Array.from(selected), action);
      toast({
        title: 'Acción completada',
        description: `${result.updated} pedido(s) actualizados.`,
      });
      setSelected(new Set());
      fetchData(filters, page);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al actualizar pagos',
        variant: 'destructive',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  // ─── CSV export ──────────────────────────────────────────────────────────
  const exportCSV = async () => {
    try {
      const params = buildParams(filters, 1);
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && k !== 'page' && k !== 'limit') q.set(k, String(v));
      });
      const token = getToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/superadmin/export/stops?${q}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error exportando CSV');
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────
  const hasActiveFilters =
    JSON.stringify(pendingFilters) !== JSON.stringify(DEFAULT_FILTERS) ||
    JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const selectedCount = selected.size;

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Sub-nav */}
      <SuperAdminNav />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            Pedidos globales
          </h1>
          <p className="text-muted-foreground text-sm hidden sm:block">
            Todos los pedidos activos y archivados
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-primary/80 inline-block" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(filters, page)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading}>
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por referencia, cliente, teléfono, tienda, repartidor, dirección..."
          value={pendingFilters.search}
          onChange={(e) => setPendingFilters((f) => ({ ...f, search: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="pl-10"
        />
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">

              {/* Estado */}
              <Select
                value={pendingFilters.status}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <Package className="w-3.5 h-3.5 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Sin asignar</SelectItem>
                  <SelectItem value="assigned">Asignado</SelectItem>
                  <SelectItem value="picked">Recogido</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              {/* Fuente */}
              <Select
                value={pendingFilters.archived}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, archived: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Fuente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Activos + archivados</SelectItem>
                  <SelectItem value="false">Solo activos</SelectItem>
                  <SelectItem value="true">Solo archivados</SelectItem>
                </SelectContent>
              </Select>

              {/* Tienda — uses '_all' sentinel to avoid Radix crash on empty value */}
              <Select
                value={pendingFilters.shop_id}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, shop_id: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas las tiendas</SelectItem>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shop_name ?? s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Repartidor — uses '_all' sentinel */}
              <Select
                value={pendingFilters.driver_id}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, driver_id: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Repartidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los repartidores</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Cobrado cliente */}
              <Select
                value={pendingFilters.paid_by_client}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, paid_by_client: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Cobro cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cobro cliente: todos</SelectItem>
                  <SelectItem value="true">Cobrado ✓</SelectItem>
                  <SelectItem value="false">Pendiente cobro</SelectItem>
                </SelectContent>
              </Select>

              {/* Pagado repartidor */}
              <Select
                value={pendingFilters.paid_to_driver}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, paid_to_driver: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Pago repartidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Pago repartidor: todos</SelectItem>
                  <SelectItem value="true">Pagado ✓</SelectItem>
                  <SelectItem value="false">Pendiente pago</SelectItem>
                </SelectContent>
              </Select>

              {/* Tipo pedido */}
              <Select
                value={pendingFilters.order_type}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, order_type: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Tipo pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tipo: todos</SelectItem>
                  <SelectItem value="business">Empresa</SelectItem>
                  <SelectItem value="individual">Particular</SelectItem>
                </SelectContent>
              </Select>

              {/* Origen */}
              <Select
                value={pendingFilters.source}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Origen: todos</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="individual_web">Particular web</SelectItem>
                </SelectContent>
              </Select>

              {/* Estado pago */}
              <Select
                value={pendingFilters.payment_status}
                onValueChange={(v) => setPendingFilters((f) => ({ ...f, payment_status: v }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Estado pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado pago: todos</SelectItem>
                  <SelectItem value="unpaid">No pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="failed">Fallido</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>

              {/* Fecha desde */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide pl-1">
                  Desde (fecha servicio)
                </label>
                <Input
                  type="date"
                  value={pendingFilters.date_from}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, date_from: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              {/* Fecha hasta */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide pl-1">
                  Hasta (fecha servicio)
                </label>
                <Input
                  type="date"
                  value={pendingFilters.date_to}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, date_to: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={applyFilters} className="flex-1 sm:flex-none">
                Aplicar filtros
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" /> Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/60 border rounded-lg">
          <span className="text-sm font-medium text-foreground mr-1">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction('mark_client_paid')}>
            ✓ Cobrado cliente
          </Button>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction('mark_client_unpaid')}>
            ✗ Cobro pendiente
          </Button>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction('mark_driver_paid')}>
            ✓ Pagado repartidor
          </Button>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction('mark_driver_unpaid')}>
            ✗ Pago pendiente
          </Button>
          <Button size="sm" variant="ghost" disabled={bulkLoading} onClick={() => setSelected(new Set())} className="ml-auto">
            <X className="w-3.5 h-3.5 mr-1" /> Deseleccionar
          </Button>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{total.toLocaleString('es-ES')}</span>{' '}pedidos
        </span>
        <span>·</span>
        <span>
          Total:{' '}
          <span className="font-semibold text-foreground">
            {summary.total_price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
          </span>
        </span>
        <span>·</span>
        <span>
          Repartidores:{' '}
          <span className="font-semibold text-foreground">
            {summary.total_price_driver.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
          </span>
        </span>
      </div>

      {/* Table — horizontally scrollable, fixed min-width */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[2600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-3">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar página"
                      disabled={activeStopsOnPage.length === 0 || loading}
                    />
                  </TableHead>
                  <TableHead className="text-xs w-10">#</TableHead>
                  <TableHead className="text-xs">Referencia</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Origen</TableHead>
                  <TableHead className="text-xs">Estado pago</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Teléfono</TableHead>
                  <TableHead className="text-xs">Email cliente</TableHead>
                  <TableHead className="text-xs">Tienda</TableHead>
                  <TableHead className="text-xs">Repartidor</TableHead>
                  <TableHead className="text-xs">Zona</TableHead>
                  <TableHead className="text-xs text-right">Km</TableHead>
                  <TableHead className="text-xs text-right">Precio</TableHead>
                  <TableHead className="text-xs text-right">Rep.</TableHead>
                  <TableHead className="text-xs text-right">Margen</TableHead>
                  <TableHead className="text-xs">Fecha servicio</TableHead>
                  <TableHead className="text-xs">Recogida</TableHead>
                  <TableHead className="text-xs">Entrega</TableHead>
                  <TableHead className="text-xs">Cobro</TableHead>
                  <TableHead className="text-xs">Pago rep.</TableHead>
                  <TableHead className="text-xs">Archivado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={22} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Cargando pedidos...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={22} className="text-center py-12 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No hay pedidos con estos filtros
                    </TableCell>
                  </TableRow>
                )}
                {data.map((stop, idx) => {
                  const st = STATUS_LABELS[stop.status] ?? { label: stop.status, variant: 'secondary' as const };
                  const rowNum = (page - 1) * LIMIT + idx + 1;
                  const isSelected = selected.has(stop.id);
                  const zoneName = getZoneName(stop.distance_km, zones);
                  const priceDriver = effectivePriceDriver(stop);
                  const margin = effectiveMargin(stop);

                  return (
                    <TableRow
                      key={stop.id}
                      className={cn(
                        loading ? 'opacity-50' : '',
                        isSelected ? 'bg-muted/40' : '',
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="px-3 py-2">
                        {!stop.is_archived ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(stop.id, stop.is_archived)}
                            aria-label={`Seleccionar ${stop.order_code}`}
                          />
                        ) : (
                          <span className="w-4 h-4 block" />
                        )}
                      </TableCell>

                      {/* # */}
                      <TableCell className="text-xs text-muted-foreground py-2 w-10">
                        {rowNum}
                      </TableCell>

                      {/* Referencia */}
                      <TableCell className="font-mono text-xs py-2 whitespace-nowrap">
                        {stop.order_code ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-2">
                        <Badge variant={st.variant} className="text-[10px] whitespace-nowrap">
                          {st.label}
                        </Badge>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell className="py-2">
                        {(() => {
                          const isIndividual = stop.order_type === 'individual' || stop.source === 'individual_web' || (stop.order_code?.startsWith('LXP-') ?? false);
                          return (
                            <span className={`text-[10px] font-medium whitespace-nowrap ${isIndividual ? 'text-blue-600' : 'text-muted-foreground'}`}>
                              {isIndividual ? 'Particular' : 'Empresa'}
                            </span>
                          );
                        })()}
                      </TableCell>

                      {/* Origen */}
                      <TableCell className="py-2">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {SOURCE_LABELS[stop.source] ?? stop.source}
                        </span>
                      </TableCell>

                      {/* Estado pago */}
                      <TableCell className="py-2">
                        {(() => {
                          const ps = PAYMENT_STATUS_LABELS[stop.payment_status] ?? { label: stop.payment_status, color: 'text-muted-foreground' };
                          return (
                            <span className={`text-[10px] font-medium whitespace-nowrap ${ps.color}`}>
                              {ps.label}
                            </span>
                          );
                        })()}
                      </TableCell>

                      {/* Cliente */}
                      <TableCell className="py-2">
                        <span className="text-xs font-medium truncate max-w-[110px] block">{stop.client_name}</span>
                      </TableCell>

                      {/* Teléfono */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {stop.client_phone ?? '—'}
                        </span>
                      </TableCell>

                      {/* Email cliente */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground truncate max-w-[130px] block">
                          {stop.customer_email ?? '—'}
                        </span>
                      </TableCell>

                      {/* Tienda */}
                      <TableCell className="py-2">
                        <span className="text-xs truncate max-w-[100px] block">
                          {stop.shop_name ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>

                      {/* Repartidor */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground truncate max-w-[100px] block">
                          {stop.driver_name || '—'}
                        </span>
                      </TableCell>

                      {/* Zona */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{zoneName}</span>
                      </TableCell>

                      {/* Km */}
                      <TableCell className="py-2 text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {stop.distance_km != null ? `${Number(stop.distance_km).toFixed(1)} km` : '—'}
                        </span>
                      </TableCell>

                      {/* Precio total */}
                      <TableCell className="py-2 text-right">
                        <span className="text-xs font-medium whitespace-nowrap">{fmtEur(stop.price)}</span>
                      </TableCell>

                      {/* Precio repartidor (70% fallback) */}
                      <TableCell className="py-2 text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtEur(priceDriver)}
                          {stop.price_driver == null && stop.price != null && (
                            <span className="text-[9px] ml-0.5 opacity-60">est.</span>
                          )}
                        </span>
                      </TableCell>

                      {/* Margen empresa */}
                      <TableCell className="py-2 text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtEur(margin)}</span>
                      </TableCell>

                      {/* Fecha servicio */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{serviceDate(stop)}</span>
                      </TableCell>

                      {/* Recogida */}
                      <TableCell className="py-2 max-w-[140px]">
                        {stop.pickup_address ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground truncate block cursor-default" title={stop.pickup_address}>
                                {stop.pickup_address}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                              {stop.pickup_address}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Entrega */}
                      <TableCell className="py-2 max-w-[140px]">
                        {stop.delivery_address ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground truncate block cursor-default" title={stop.delivery_address}>
                                {stop.delivery_address}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                              {stop.delivery_address}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Cobro cliente */}
                      <TableCell className="py-2">
                        <span className={cn('text-[10px] font-semibold whitespace-nowrap', stop.paid_by_client ? 'text-emerald-600' : 'text-orange-500')}>
                          {stop.paid_by_client ? '✓ Cobrado' : '⏳ Pendiente'}
                        </span>
                      </TableCell>

                      {/* Pago repartidor */}
                      <TableCell className="py-2">
                        <span className={cn('text-[10px] font-semibold whitespace-nowrap', stop.paid_to_driver ? 'text-emerald-600' : 'text-red-500')}>
                          {stop.paid_to_driver ? '✓ Pagado' : '⏳ Pendiente'}
                        </span>
                      </TableCell>

                      {/* Archivado */}
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground">
                          {stop.is_archived ? '✓' : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Página {page} de {totalPages} · {total.toLocaleString('es-ES')} pedidos
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 px-0 text-xs"
                  onClick={() => goToPage(p)}
                  disabled={loading}
                >
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => goToPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
