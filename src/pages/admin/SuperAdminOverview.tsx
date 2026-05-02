import { useEffect } from 'react';
import { useSuperAdminMetrics } from '@/hooks/useSuperAdminMetrics';
import { SuperAdminNav } from './SuperAdminOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  ShieldCheck,
  Package,
  Users,
  DollarSign,
  Image,
  Activity,
  TrendingUp,
  Truck,
  Store,
  UserCheck,
  Clock,
  Globe,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtNum(value: number): string {
  return value.toLocaleString('es-ES');
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return '—';
  }
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'default' | 'green' | 'orange' | 'red' | 'blue';
}

function MetricCard({ label, value, sub, icon, accent = 'default' }: MetricCardProps) {
  const accentClass: Record<string, string> = {
    default: '',
    green: 'text-emerald-600',
    orange: 'text-orange-500',
    red: 'text-red-500',
    blue: 'text-blue-600',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          {icon && <span className="text-muted-foreground/60">{icon}</span>}
        </div>
        <p className={`text-2xl font-bold leading-none ${accentClass[accent]}`}>
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminOverview() {
  const { data, loading, error, refresh } = useSuperAdminMetrics();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Sub-nav */}
      <SuperAdminNav />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            Superadmin
          </h1>
          <p className="text-muted-foreground text-sm hidden sm:block">
            Visión global del sistema LocalXpress
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-3 bg-muted rounded animate-pulse mb-3 w-3/4" />
                <div className="h-7 bg-muted rounded animate-pulse w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="space-y-8">

          {/* 1. Resumen operativo */}
          <Section title="Resumen operativo" icon={<TrendingUp className="w-4 h-4" />}>
            <MetricCard
              label="Pedidos hoy"
              value={data.stops.stops_today}
              icon={<Package className="w-4 h-4" />}
              accent="blue"
            />
            <MetricCard
              label="Pedidos esta semana"
              value={data.stops.stops_this_week}
              icon={<Package className="w-4 h-4" />}
            />
            <MetricCard
              label="Pedidos este mes"
              value={data.stops.stops_this_month}
              icon={<Package className="w-4 h-4" />}
            />
            <MetricCard
              label="Pedidos activos"
              value={data.stops.total_active_stops}
              sub="En la tabla stops"
              icon={<Activity className="w-4 h-4" />}
              accent="blue"
            />
            <MetricCard
              label="Pedidos archivados"
              value={data.stops.total_archived_stops}
              sub="+32 días"
              icon={<Package className="w-4 h-4" />}
            />
          </Section>

          <Separator />

          {/* 2. Estados de pedidos */}
          <Section title="Estados" icon={<Activity className="w-4 h-4" />}>
            <MetricCard label="Sin asignar" value={data.stops.pending_stops} />
            <MetricCard label="Asignados" value={data.stops.assigned_stops} accent="blue" />
            <MetricCard label="Recogidos" value={data.stops.picked_stops} accent="orange" />
            <MetricCard label="Entregados" value={data.stops.delivered_stops} accent="green" />
            <MetricCard label="Cancelados" value={data.stops.cancelled_stops} accent="red" />
          </Section>

          <Separator />

          {/* 3. Usuarios */}
          <Section title="Usuarios" icon={<Users className="w-4 h-4" />}>
            <MetricCard
              label="Administradores"
              value={data.users.total_admins}
              icon={<ShieldCheck className="w-4 h-4" />}
            />
            <MetricCard
              label="Tiendas"
              value={data.users.total_shops}
              icon={<Store className="w-4 h-4" />}
            />
            <MetricCard
              label="Repartidores"
              value={data.users.total_drivers}
              icon={<Truck className="w-4 h-4" />}
            />
            <MetricCard
              label="Usuarios activos"
              value={data.users.active_users}
              sub={`de ${fmtNum(data.users.total_users)} totales`}
              icon={<UserCheck className="w-4 h-4" />}
              accent="green"
            />
          </Section>

          <Separator />

          {/* 4. Finanzas */}
          <Section title="Finanzas" icon={<DollarSign className="w-4 h-4" />}>
            <MetricCard
              label="Ingresos hoy"
              value={fmtEur(data.finances.revenue_today)}
              icon={<DollarSign className="w-4 h-4" />}
              accent="green"
            />
            <MetricCard
              label="Ingresos este mes"
              value={fmtEur(data.finances.revenue_this_month)}
              icon={<DollarSign className="w-4 h-4" />}
              accent="green"
            />
            <MetricCard
              label="Pendiente cobro cliente"
              value={fmtEur(data.finances.total_pending_client_payment)}
              sub="Clientes sin pagar"
              icon={<DollarSign className="w-4 h-4" />}
              accent={data.finances.total_pending_client_payment > 0 ? 'orange' : 'default'}
            />
            <MetricCard
              label="Pendiente pago repartidor"
              value={fmtEur(data.finances.total_pending_driver_payment)}
              sub="Repartidores sin cobrar"
              icon={<Truck className="w-4 h-4" />}
              accent={data.finances.total_pending_driver_payment > 0 ? 'red' : 'default'}
            />
            <MetricCard
              label="Cobrado a clientes"
              value={fmtEur(data.finances.total_paid_by_clients)}
              accent="green"
            />
            <MetricCard
              label="Pagado a repartidores"
              value={fmtEur(data.finances.total_paid_to_drivers)}
            />
            <MetricCard
              label="Margen empresa estimado"
              value={fmtEur(data.finances.estimated_company_margin)}
              sub="Suma price_company"
              accent="blue"
            />
          </Section>

          <Separator />

          {/* 5. Fotos / almacenamiento */}
          <Section title="Fotos y almacenamiento" icon={<Image className="w-4 h-4" />}>
            <MetricCard
              label="Total fotos"
              value={data.photos.total_photos}
              icon={<Image className="w-4 h-4" />}
            />
            <MetricCard
              label="Espacio usado"
              value={`${data.photos.total_photo_size_mb.toFixed(2)} MB`}
              sub={`${fmtNum(data.photos.total_photo_size_bytes)} bytes`}
              icon={<Image className="w-4 h-4" />}
            />
            <MetricCard
              label="Última foto subida"
              value={fmtDate(data.photos.latest_photo_created_at)}
              icon={<Clock className="w-4 h-4" />}
            />
          </Section>

          <Separator />

          {/* 6. Pedidos por tipo (hoy) — only shown if backend returns this section */}
          {data.order_types && (
            <Section title="Empresa vs Particular (hoy)" icon={<Globe className="w-4 h-4" />}>
              <MetricCard
                label="Empresa hoy"
                value={data.order_types.business_today ?? 0}
                icon={<Building2 className="w-4 h-4" />}
                accent="blue"
              />
              <MetricCard
                label="Particular hoy"
                value={data.order_types.individual_today ?? 0}
                icon={<Globe className="w-4 h-4" />}
                accent="orange"
              />
              <MetricCard
                label="Particulares pagados hoy"
                value={data.order_types.individual_paid_today ?? 0}
                icon={<DollarSign className="w-4 h-4" />}
                accent="green"
              />
              <MetricCard
                label="Particulares pendientes/fallidos"
                value={data.order_types.individual_pending_today ?? 0}
                icon={<Activity className="w-4 h-4" />}
                accent={(data.order_types.individual_pending_today ?? 0) > 0 ? 'orange' : 'default'}
              />
              <MetricCard
                label="Ingresos empresa (hoy)"
                value={fmtEur(data.order_types.revenue_business_today ?? 0)}
                icon={<Building2 className="w-4 h-4" />}
                accent="blue"
              />
              <MetricCard
                label="Ingresos particular (hoy)"
                value={fmtEur(data.order_types.revenue_individual_today ?? 0)}
                icon={<Globe className="w-4 h-4" />}
                accent="green"
              />
            </Section>
          )}

          <Separator />

          {/* 7. Actividad reciente */}
          <Section title="Actividad reciente" icon={<Clock className="w-4 h-4" />}>
            <MetricCard
              label="Último pedido creado"
              value={fmtDate(data.activity.last_stop_created_at)}
              icon={<Package className="w-4 h-4" />}
            />
            <MetricCard
              label="Último usuario creado"
              value={fmtDate(data.activity.last_user_created_at)}
              icon={<Users className="w-4 h-4" />}
            />
          </Section>

        </div>
      )}
    </div>
  );
}
