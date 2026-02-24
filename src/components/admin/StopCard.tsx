import { forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Stop, Profile } from '@/lib/supabase-types';
import { getDeliveryZone, adjustDistance } from '@/lib/delivery-zones';
import { MapPin, User, Phone, Clock, ChevronRight, Route } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StopCardProps {
  stop: Stop;
  driver?: Profile | null;
  onClick?: () => void;
  className?: string;
}

export const StopCard = forwardRef<HTMLDivElement, StopCardProps>(
  ({ stop, driver, onClick, className }, ref) => {
    return (
      <Card 
        ref={ref}
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
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-3">
              {/* Client & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{stop.client_name}</span>
                  {stop.order_code && (
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{stop.order_code}</span>
                  )}
                </div>
                <StatusBadge status={stop.status} />
              </div>

              {/* Addresses */}
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground truncate">{stop.pickup_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-status-delivered mt-1.5 shrink-0" />
                  <span className="text-muted-foreground truncate">{stop.delivery_address}</span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {stop.distance_km != null && (
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <Route className="w-3 h-3" />
                    {adjustDistance(stop.distance_km)} km · {getDeliveryZone(stop.distance_km)}
                  </span>
                )}
                {stop.client_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {stop.client_phone}
                  </span>
                )}
                {driver && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {driver.full_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(stop.created_at), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }
);

StopCard.displayName = "StopCard";
