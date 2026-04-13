import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DriverDetailDialog } from '@/components/admin/DriverDetailDialog';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice } from '@/lib/pricing';
import type { Profile, ProfileWithRole } from '@/lib/supabase-types';
import { Users, UserPlus, Bike, Store, Shield, Search, Euro, Package, MapPin, Phone, User, Clock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type FilterTab = 'drivers' | 'shops' | 'admins';

export default function AdminUsers() {
  const { allUsers, allStops, stops, loading, fetchData, getDriverLocation, getDriverStopsCount, driverLocations } = useAdminData();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState<FilterTab>('drivers');
  const [search, setSearch] = useState('');

  const drivers = useMemo(() => allUsers.filter(u => u.role === 'driver'), [allUsers]);
  const shops = useMemo(() => allUsers.filter(u => u.role === 'shop'), [allUsers]);
  const admins = useMemo(() => allUsers.filter(u => u.role === 'admin'), [allUsers]);

  const filtered = useMemo(() => {
    const list = tab === 'drivers' ? drivers : tab === 'shops' ? shops : admins;
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.shop_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.nif?.toLowerCase().includes(q)
    );
  }, [tab, drivers, shops, admins, search]);

  // Driver earnings
  const getDriverEarnings = (driverId: string) => {
    const driverStops = allStops.filter(s => s.driver_id === driverId);
    const total = driverStops.reduce((sum, s) => sum + (Number(s.price_driver) || 0), 0);
    const paid = driverStops.filter(s => s.paid_to_driver).reduce((sum, s) => sum + (Number(s.price_driver) || 0), 0);
    const pending = total - paid;
    const deliveredCount = driverStops.filter(s => s.status === 'delivered').length;
    const paidCount = driverStops.filter(s => s.paid_to_driver).length;
    return { total, paid, pending, deliveredCount, totalStops: driverStops.length, paidCount };
  };

  const totalDriverEarnings = useMemo(() =>
    drivers.reduce((sum, d) => sum + getDriverEarnings(d.id).total, 0)
  , [drivers, allStops]);

  const totalPendingDriverPay = useMemo(() =>
    drivers.reduce((sum, d) => sum + getDriverEarnings(d.id).pending, 0)
  , [drivers, allStops]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">{allUsers.length} usuarios registrados</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <UserPlus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nuevo usuario</span>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{allUsers.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent"><Bike className="w-5 h-5 text-accent-foreground" /></div>
          <div><p className="text-xl font-bold">{drivers.length}</p><p className="text-[10px] text-muted-foreground">Repartidores</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10"><Euro className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{formatPrice(totalDriverEarnings)}</p><p className="text-[10px] text-muted-foreground">Ganado drivers</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-destructive/10"><Euro className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xl font-bold">{formatPrice(totalPendingDriverPay)}</p><p className="text-[10px] text-muted-foreground">Pendiente pago</p></div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="drivers" className="flex-1 text-xs sm:text-sm">🚴 Repartidores ({drivers.length})</TabsTrigger>
          <TabsTrigger value="shops" className="flex-1 text-xs sm:text-sm">🏪 Tiendas ({shops.length})</TabsTrigger>
          <TabsTrigger value="admins" className="flex-1 text-xs sm:text-sm">👑 Admins ({admins.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, teléfono, NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map((user) => {
          const isDriver = user.role === 'driver';
          const location = isDriver ? getDriverLocation(user.id) : undefined;
          const isOnline = location && new Date(location.updated_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;
          const earnings = isDriver ? getDriverEarnings(user.id) : null;

          return (
            <Card
              key={user.id}
              className="cursor-pointer card-hover"
              onClick={() => { setSelectedDriver(user); setDetailOpen(true); }}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.full_name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-secondary-foreground" />
                      )}
                    </div>
                    {isDriver && (
                      <div className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card', isOnline ? 'bg-status-delivered' : 'bg-muted-foreground')} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{user.shop_name || user.full_name}</h3>
                      {!user.is_active && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      {user.role === 'admin' && <Badge className="text-[10px]">Admin</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      {user.shop_name && user.role === 'shop' && <span>{user.full_name}</span>}
                      {user.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{user.phone}</span>}
                      {user.nif && <span>{user.nif}</span>}
                      {isDriver && location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {formatDistanceToNow(new Date(location.updated_at), { addSuffix: true, locale: es })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Driver stats */}
                  {isDriver && earnings && (
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-bold">{earnings.deliveredCount}</span>
                      </div>
                      <p className="text-[10px] font-semibold text-primary">{formatPrice(earnings.total)}</p>
                      {earnings.pending > 0 && (
                        <p className="text-[10px] text-destructive">{formatPrice(earnings.pending)} pend.</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto opacity-40 mb-2" />
          No se encontraron usuarios
        </CardContent></Card>
      )}

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={fetchData} />
      <DriverDetailDialog driver={selectedDriver} stops={allStops} open={detailOpen} onOpenChange={setDetailOpen} onUpdate={fetchData} />
    </div>
  );
}
