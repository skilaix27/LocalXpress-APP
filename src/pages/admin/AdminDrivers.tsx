import { useAdminData } from '@/hooks/useAdminData';
import { DriverCard } from '@/components/admin/DriverCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff } from 'lucide-react';

export default function AdminDrivers() {
  const { drivers, loading, getDriverLocation, getDriverStopsCount, driverLocations } = useAdminData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const onlineDrivers = drivers.filter((d) => {
    const loc = getDriverLocation(d.id);
    return loc && new Date(loc.updated_at).getTime() > Date.now() - 5 * 60 * 1000;
  });
  const offlineDrivers = drivers.filter((d) => !onlineDrivers.includes(d));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Repartidores</h1>
        <p className="text-muted-foreground">Gestiona tu equipo de reparto</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[hsl(var(--status-delivered-bg))]">
              <Wifi className="w-6 h-6 text-status-delivered" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineDrivers.length}</p>
              <p className="text-sm text-muted-foreground">En línea</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted">
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{offlineDrivers.length}</p>
              <p className="text-sm text-muted-foreground">Desconectados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online */}
      {onlineDrivers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-status-delivered animate-pulse" />
            En línea
            <Badge variant="secondary">{onlineDrivers.length}</Badge>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {onlineDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                location={getDriverLocation(driver.id)}
                activeStopsCount={getDriverStopsCount(driver.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Offline */}
      {offlineDrivers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
            Desconectados
            <Badge variant="secondary">{offlineDrivers.length}</Badge>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {offlineDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                location={getDriverLocation(driver.id)}
                activeStopsCount={getDriverStopsCount(driver.id)}
              />
            ))}
          </div>
        </div>
      )}

      {drivers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay repartidores registrados</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
