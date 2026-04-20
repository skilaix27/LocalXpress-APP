import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { MapPin, Clock, Package, ChevronRight, Store, CalendarClock, Route } from 'lucide-react';
import { getPackageSizeLabel } from '@/lib/package-size';
import { adjustDistance, getDeliveryZone, getDeliveryPrice } from '@/lib/delivery-zones';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { isStopForToday } from '@/lib/stop-schedule';
import { useMemo } from 'react';

interface DriverStopsListProps {
  stops: Stop[];
  onSelectStop: (stop: Stop) => void;
}

function StopItem({ stop, index, onSelectStop }: { stop: Stop; index: number; onSelectStop: (stop: Stop) => void }) {
  return (
    <motion.div
      key={stop.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card
        className="active:scale-[0.98] transition-transform cursor-pointer border-l-4"
        style={{
          borderLeftColor: stop.status === 'picked'
            ? 'hsl(var(--status-picked))'
            : stop.status === 'assigned'
            ? 'hsl(var(--status-assigned))'
            : 'hsl(var(--status-pending))',
        }}
        onClick={() => onSelectStop(stop)}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{stop.client_name}</span>
                  {stop.order_code && (
                    <span className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded text-muted-foreground">{stop.order_code}</span>
                  )}
                  <StatusBadge status={stop.status} />
                </div>
                {stop.shop_name && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground font-medium">
                    <Store className="w-3 h-3" />
                    {stop.shop_name}
                  </div>
                )}
                {stop.scheduled_pickup_at && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-primary font-medium">
                    <Clock className="w-3 h-3" />
                    {format(new Date(stop.scheduled_pickup_at), "d MMM · HH:mm", { locale: es })}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{stop.pickup_address}</span>
                </div>
                {stop.distance_km != null && (() => {
                  const adj = adjustDistance(stop.distance_km);
                  const zone = getDeliveryZone(stop.distance_km);
                  const price = getDeliveryPrice(stop.distance_km);
                  return (
                    <div className="flex items-center gap-1 mt-0.5 text-xs">
                      <Route className="w-3 h-3 shrink-0 text-primary" />
                      <span className="font-semibold text-primary">{adj} km</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{zone}</span>
                      {price != null && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold text-primary">{price} €</span>
                        </>
                      )}
                    </div>
                  );
                })()}
                {stop.package_size && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground font-medium">
                    <Package className="w-3 h-3" />
                    {getPackageSizeLabel(stop.package_size)}
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DriverStopsList({ stops, onSelectStop }: DriverStopsListProps) {
  const pending = stops.filter(s => s.status === 'pending' || s.status === 'assigned');
  const picked = stops.filter(s => s.status === 'picked');

  const todayStops = useMemo(() => stops.filter(s => isStopForToday(s)), [stops]);
  const scheduledStops = useMemo(() => stops.filter(s => !isStopForToday(s)), [stops]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stops.length}</p>
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">TOTAL</p>
        </div>
        <div className="bg-status-pending/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-status-pending">{pending.length}</p>
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">PENDIENTES</p>
        </div>
        <div className="bg-status-picked/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-status-picked">{picked.length}</p>
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">RECOGIDOS</p>
        </div>
      </div>

      {/* Today's stops */}
      {todayStops.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Hoy ({todayStops.length})
          </h3>
          {todayStops.map((stop, i) => (
            <StopItem key={stop.id} stop={stop} index={i} onSelectStop={onSelectStop} />
          ))}
        </div>
      )}

      {/* Scheduled for other days */}
      {scheduledStops.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" />
            Programadas ({scheduledStops.length})
          </h3>
          <div className="space-y-2 p-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
            {scheduledStops.map((stop, i) => (
              <StopItem key={stop.id} stop={stop} index={todayStops.length + i} onSelectStop={onSelectStop} />
            ))}
          </div>
        </div>
      )}

      {stops.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No tienes paradas asignadas</p>
        </div>
      )}
    </div>
  );
}
