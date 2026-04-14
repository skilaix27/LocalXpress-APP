import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Stop } from '@/lib/supabase-types';
import { User, Phone, Clock, ChevronRight, Route, MapPin, Store, CalendarClock, Package } from 'lucide-react';
import { getPackageSizeLabel } from '@/lib/package-size';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { adjustDistance, getDeliveryZone, getDeliveryPrice } from '@/lib/delivery-zones';

interface ShopStopCardProps {
  stop: Stop;
  onClick?: () => void;
  className?: string;
}

export function ShopStopCard({ stop, onClick, className }: ShopStopCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer card-hover border-l-4',
        stop.status === 'pending' && 'border-l-muted-foreground',
        stop.status === 'assigned' && 'border-l-status-assigned',
        stop.status === 'picked' && 'border-l-status-picked',
        stop.status === 'delivered' && 'border-l-status-delivered',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
            {/* Client & Status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm sm:text-base truncate">{stop.client_name}</span>
                {stop.order_code && (
                  <span className="text-[10px] sm:text-xs font-mono bg-muted px-1 sm:px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                    {stop.order_code}
                  </span>
                )}
              </div>
              <StatusBadge status={stop.status} />
            </div>
            {stop.shop_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Store className="w-3 h-3" />
                {stop.shop_name}
              </div>
            )}

            {/* Addresses */}
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <span className="text-muted-foreground line-clamp-1">{stop.pickup_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-status-delivered mt-1.5 shrink-0" />
                <span className="text-muted-foreground line-clamp-1">{stop.delivery_address}</span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
              {stop.scheduled_pickup_at && (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <CalendarClock className="w-3 h-3" />
                  {format(new Date(stop.scheduled_pickup_at), "d MMM · HH:mm", { locale: es })}
                </span>
              )}
              {stop.distance_km != null && (() => {
                const price = getDeliveryPrice(stop.distance_km);
                return (
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <Route className="w-3 h-3" />
                    {adjustDistance(stop.distance_km)} km · {getDeliveryZone(stop.distance_km)}
                    {price != null && <span className="ml-1">· {price} €</span>}
                  </span>
                );
              })()}
              {stop.package_size && (
                <span className="flex items-center gap-1 font-medium">
                  <Package className="w-3 h-3" />
                  {getPackageSizeLabel(stop.package_size)}
                </span>
              )}
              {stop.client_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {stop.client_phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(stop.created_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
              {stop.status === 'delivered' && stop.delivered_at && (
                <span className="flex items-center gap-1 text-status-delivered font-medium">
                  Entregado {format(new Date(stop.delivered_at), "dd/MM HH:mm", { locale: es })}
                </span>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
