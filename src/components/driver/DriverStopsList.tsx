import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { MapPin, Clock, Package, ChevronRight, Store } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';

interface DriverStopsListProps {
  stops: Stop[];
  onSelectStop: (stop: Stop) => void;
}

export function DriverStopsList({ stops, onSelectStop }: DriverStopsListProps) {
  const pending = stops.filter(s => s.status === 'pending' || s.status === 'assigned');
  const picked = stops.filter(s => s.status === 'picked');

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

      {/* Stop list */}
      <div className="space-y-2">
        {stops.map((stop, i) => (
          <motion.div
            key={stop.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
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
                      {i + 1}
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
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
