import { useState, useMemo } from 'react';
import { useShopData } from '@/hooks/useShopData';
import { ShopStopCard } from '@/components/shop/ShopStopCard';
import { ShopStopDetailDialog } from '@/components/shop/ShopStopDetailDialog';
import { CreateShopStopDialog } from '@/components/shop/CreateShopStopDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Stop, StopStatus } from '@/lib/supabase-types';
import { Plus, Package, Truck, CheckCircle, UserCheck, Search, ArrowUpDown, ListFilter, SlidersHorizontal, X, CalendarClock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isStopForToday } from '@/lib/stop-schedule';

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export default function ShopDashboard() {
  const { profile } = useAuth();
  const {
    activeStops, todayDelivered, olderDelivered, fetchData,
    pendingCount, assignedCount, pickedCount, deliveredCount,
  } = useShopData();

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StopStatus>('all');
  const [selectedPackageSize, setSelectedPackageSize] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const filteredActive = useMemo(() => {
    let result = [...activeStops];

    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    if (selectedPackageSize !== 'all') {
      result = result.filter(s => s.package_size === selectedPackageSize);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.client_name.toLowerCase().includes(q) ||
        s.delivery_address.toLowerCase().includes(q) ||
        s.pickup_address.toLowerCase().includes(q) ||
        (s.order_code && s.order_code.toLowerCase().includes(q)) ||
        (s.client_phone && s.client_phone.includes(q))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc': return a.client_name.localeCompare(b.client_name);
        case 'name_desc': return b.client_name.localeCompare(a.client_name);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [activeStops, statusFilter, selectedPackageSize, search, sortBy]);

  const todayActive = useMemo(() => filteredActive.filter(s => isStopForToday(s)), [filteredActive]);
  const scheduledActive = useMemo(() => filteredActive.filter(s => !isStopForToday(s)), [filteredActive]);

  const hasActiveFilters = search || statusFilter !== 'all' || selectedPackageSize !== 'all' || sortBy !== 'newest';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSelectedPackageSize('all');
    setSortBy('newest');
  };

  const stats = [
    { label: 'Pendientes', value: pendingCount, icon: Package, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Asignados', value: assignedCount, icon: UserCheck, color: 'text-status-assigned', bg: 'bg-[hsl(var(--status-assigned-bg))]' },
    { label: 'En camino', value: pickedCount, icon: Truck, color: 'text-status-picked', bg: 'bg-[hsl(var(--status-picked-bg))]' },
    { label: 'Entregados', value: deliveredCount, icon: CheckCircle, color: 'text-status-delivered', bg: 'bg-[hsl(var(--status-delivered-bg))]' },
  ];

  const handleClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailOpen(true);
  };

  if (!activeStops) {
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
          <h1 className="text-xl sm:text-2xl font-bold">
            {profile?.shop_name ? `¡Hola, ${profile.shop_name}!` : 'Mi Panel'}
          </h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Estado de tus pedidos en tiempo real</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nuevo pedido</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card>
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active stops with filters */}
      <Card>
        <CardHeader className="pb-2 px-3 pt-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">
              Pedidos activos ({filteredActive.length}{hasActiveFilters ? ` de ${activeStops.length}` : ''})
            </CardTitle>
            <Button
              variant={showFilters ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline text-xs">Filtros</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {showFilters && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, dirección, referencia..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="text-xs flex-1">Todos</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs flex-1">Pendiente</TabsTrigger>
                  <TabsTrigger value="assigned" className="text-xs flex-1">Asignado</TabsTrigger>
                  <TabsTrigger value="picked" className="text-xs flex-1">Recogido</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-2 gap-2">
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

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="text-xs">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Más recientes</SelectItem>
                    <SelectItem value="oldest">Más antiguos</SelectItem>
                    <SelectItem value="name_asc">Cliente A-Z</SelectItem>
                    <SelectItem value="name_desc">Cliente Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
                  <X className="w-3.5 h-3.5 mr-1" /> Limpiar filtros
                </Button>
              )}
            </div>
          )}

          {/* Today's active stops */}
          {todayActive.length > 0 && (
            <div className="space-y-3">
              {scheduledActive.length > 0 && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Hoy ({todayActive.length})
                </h3>
              )}
              {todayActive.map((stop) => (
                <ShopStopCard key={stop.id} stop={stop} onClick={() => handleClick(stop)} />
              ))}
            </div>
          )}

          {/* Scheduled for other days */}
          {scheduledActive.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Programadas ({scheduledActive.length})
              </h3>
              <div className="space-y-3 p-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
                {scheduledActive.map((stop) => (
                  <ShopStopCard key={stop.id} stop={stop} onClick={() => handleClick(stop)} />
                ))}
              </div>
            </div>
          )}

          {filteredActive.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'No se encontraron pedidos con estos filtros' : 'No tienes pedidos activos'}
              </p>
              {!hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Crear pedido
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's delivered */}
      {todayDelivered.length > 0 && (
        <Card>
          <CardHeader className="pb-2 px-3 pt-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-status-delivered" />
              Entregados hoy ({todayDelivered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {todayDelivered.map((stop) => (
              <ShopStopCard key={stop.id} stop={stop} onClick={() => handleClick(stop)} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Link to history */}
      {olderDelivered.length > 0 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/shop/history')}>
            Ver historial ({olderDelivered.length} entregas anteriores)
          </Button>
        </div>
      )}

      <CreateShopStopDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchData} />
      <ShopStopDetailDialog stop={selectedStop} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
