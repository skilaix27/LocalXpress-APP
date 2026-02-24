import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Profile, DriverLocation } from '@/lib/supabase-types';
import { User, MapPin, Clock, Bike } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DriverCardProps {
  driver: Profile;
  location?: DriverLocation | null;
  activeStopsCount?: number;
  onClick?: () => void;
  className?: string;
}

export function DriverCard({ 
  driver, 
  location, 
  activeStopsCount = 0, 
  onClick, 
  className 
}: DriverCardProps) {
  const isOnline = location && 
    new Date(location.updated_at).getTime() > Date.now() - 5 * 60 * 1000; // 5 mins

  return (
    <Card 
      className={cn('cursor-pointer card-hover', className)}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary flex items-center justify-center">
              {driver.avatar_url ? (
                <img 
                  src={driver.avatar_url} 
                  alt={driver.full_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-secondary-foreground" />
              )}
            </div>
            {/* Online indicator */}
            <div 
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card',
                isOnline ? 'bg-status-delivered' : 'bg-muted-foreground'
              )}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{driver.full_name}</h3>
              {!driver.is_active && (
                <Badge variant="secondary" className="text-xs">Inactivo</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {driver.phone && (
                <span>{driver.phone}</span>
              )}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatDistanceToNow(new Date(location.updated_at), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary">
              <Bike className="w-4 h-4" />
              <span className="font-bold">{activeStopsCount}</span>
            </div>
            <span className="text-xs text-muted-foreground">paradas</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
