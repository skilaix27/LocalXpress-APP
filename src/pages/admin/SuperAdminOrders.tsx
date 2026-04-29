import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { superadminApi, SuperAdminStop, SuperAdminStopsParams } from '@/lib/api';
import { getToken } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShieldCheck, Package, Search, Download, RefreshCw,
  SlidersHorizontal, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending:   { label: 'Sin asignar', variant: 'secondary' },
  assigned:  { label: 'Asignado',    variant: 'outline' },
  picked:    { label: 'Recogido',    variant: 'default' },
  delivered: { label: 'Entregado',   variant: 'default' },
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

interface Filters {
  search: string;
  status: string;
  archived: string;
  date_from: string;
  date_to: string;
  paid_by_client: string;
  paid_to_driver: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  status: 'all',
  archived: 'all',
  date_from: '',
  date_to: '',
  paid_by_client: 'all',
  paid_to_driver: 'all',
};

export default function SuperAdminOrders() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SuperAdminStop[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState({ total_price: 0, total_price_driver: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const buildParams = useCallback((f: Filters, p: number): SuperAdminStopsParams => {
    const params: SuperAdminStopsParams = { page: p, limit: LIMIT };
    if (f.search)                            params.search = f.search;
    if (f.status !== 'all')                  params.status = f.status;
    if (f.archived !== 'all')                params.archived = f.archived;
    if (f.date_from)                         params.date_from = f.date_from;
    if (f.date_to)                           params.date_to = f.date_to;
    if (f.paid_by_client !== 'all')          params.paid_by_client = f.paid_by_client;
    if (f.paid_to_driver !== 'all')          params.paid_to_driver = f.paid_to_driver;
    // archived=all is the default on the endpoint too — pass it explicitly
    if (f.archived === 'all')                params.archived = 'all';
    return params;
  }, []);

  const fetchData = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    setError(null);
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

  // Initial load
  useEffect(() => { fetchData(filters, 1); }, []);   // eslint-disable-line

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

  const exportCSV = async () => {
    try {
      const params = buildParams(filters, 1);
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && k !== 'page' && k !== 'limit') q.set(k, String(v)); });

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

  const hasActiveFilters = JSON.stringify(pendingFilters) !== JSON.stringify(DEFAULT_FILTERS)
    || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

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
            {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-primary/80 inline-block" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData(filters, page)} disabled={loading}>
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

      {/* Search bar — always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por referencia, cliente, teléfono..."
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
                </SelectContent>
              </Select>

              {/* Fuente: activos / archivados / todos */}
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

              {/* Fecha desde */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide pl-1">Desde</label>
                <Input
                  type="date"
                  value={pendingFilters.date_from}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, date_from: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              {/* Fecha hasta */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide pl-1">Hasta</label>
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

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{total.toLocaleString('es-ES')}</span> pedidos
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Referencia</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Tienda</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Repartidor</TableHead>
                <TableHead className="text-xs text-right hidden sm:table-cell">Precio</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Cobro</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Pago rep.</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Creado</TableHead>
                <TableHead className="text-xs hidden xl:table-cell">Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando pedidos...
                  </TableCell>
                </TableRow>
              )}
              {!loading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay pedidos con estos filtros
                  </TableCell>
                </TableRow>
              )}
              {data.map((stop) => {
                const st = STATUS_LABELS[stop.status] ?? { label: stop.status, variant: 'secondary' as const };
                return (
                  <TableRow key={stop.id} className={loading ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-xs py-2">
                      {stop.order_code ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant={st.variant} className="text-[10px] whitespace-nowrap">
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="max-w-[120px]">
                        <p className="text-xs font-medium truncate">{stop.client_name}</p>
                        {stop.client_phone && (
                          <p className="text-[10px] text-muted-foreground">{stop.client_phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden md:table-cell">
                      <span className="text-xs truncate max-w-[100px] block">
                        {stop.shop_name ?? <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {stop.driver_name || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right hidden sm:table-cell">
                      <span className="text-xs font-medium">{fmtEur(stop.price)}</span>
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <span className={cn('text-[10px] font-semibold', stop.paid_by_client ? 'text-emerald-600' : 'text-orange-500')}>
                        {stop.paid_by_client ? '✓ Cobrado' : '⏳ Pendiente'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <span className={cn('text-[10px] font-semibold', stop.paid_to_driver ? 'text-emerald-600' : 'text-red-500')}>
                        {stop.paid_to_driver ? '✓ Pagado' : '⏳ Pendiente'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(stop.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 hidden xl:table-cell">
                      {stop.is_archived ? (
                        <Badge variant="secondary" className="text-[10px]">Archivado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Activo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Página {page} de {totalPages} · {total.toLocaleString('es-ES')} pedidos
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {/* Page numbers — show up to 5 around current */}
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
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
