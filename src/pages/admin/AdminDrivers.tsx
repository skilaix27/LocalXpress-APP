import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DriverCard } from '@/components/admin/DriverCard';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { DriverDetailDialog } from '@/components/admin/DriverDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Bike, Store, Shield } from 'lucide-react';
import type { Profile, AppRole } from '@/lib/supabase-types';

type FilterRole = 'all' | AppRole;

const roleConfig: Record<AppRole, { label: string; icon: typeof Users; emoji: string }> = {
  admin: { label: 'Administradores', icon: Shield, emoji: '👑' },
  driver: { label: 'Repartidores', icon: Bike, emoji: '🚴' },
  shop: { label: 'Tiendas', icon: Store, emoji: '🏪' },
};

export default function AdminUsers() {
  const { allUsers, stops, loading, fetchData, getDriverLocation, getDriverStopsCount } = useAdminData();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const adminCount = allUsers.filter((u) => u.role === 'admin').length;
  const driverCount = allUsers.filter((u) => u.role === 'driver').length;
  const shopCount = allUsers.filter((u) => u.role === 'shop').length;

  const filteredUsers = roleFilter === 'all' ? allUsers : allUsers.filter((u) => u.role === roleFilter);

  // Group filtered users by role
  const groupedUsers = (['admin', 'driver', 'shop'] as AppRole[])
    .map((role) => ({
      role,
      users: filteredUsers.filter((u) => u.role === role),
    }))
    .filter((g) => g.users.length > 0);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Gestiona todos los usuarios del sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="shrink-0">
          <UserPlus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nuevo usuario</span>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{allUsers.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-accent">
              <Bike className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{driverCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Repartidores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-accent">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{shopCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Tiendas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-accent">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{adminCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role filter tabs */}
      <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as FilterRole)}>
        <TabsList className="w-full overflow-x-auto flex justify-start sm:justify-center">
          <TabsTrigger value="all" className="text-xs sm:text-sm">Todos ({allUsers.length})</TabsTrigger>
          <TabsTrigger value="driver" className="text-xs sm:text-sm">🚴 Repart. ({driverCount})</TabsTrigger>
          <TabsTrigger value="shop" className="text-xs sm:text-sm">🏪 Tiendas ({shopCount})</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs sm:text-sm">👑 Admins ({adminCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grouped user lists */}
      {groupedUsers.map(({ role, users }) => (
        <div key={role} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {roleConfig[role].emoji} {roleConfig[role].label}
            <Badge variant="secondary">{users.length}</Badge>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {users.map((user) => (
              <DriverCard
                key={user.id}
                driver={user}
                location={role === 'driver' ? getDriverLocation(user.id) : undefined}
                activeStopsCount={role === 'driver' ? getDriverStopsCount(user.id) : undefined}
                onClick={() => {
                  setSelectedDriver(user);
                  setDetailOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {allUsers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay usuarios registrados</p>
          </CardContent>
        </Card>
      )}

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={fetchData} />
      <DriverDetailDialog
        driver={selectedDriver}
        stops={stops}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={fetchData}
      />
    </div>
  );
}
