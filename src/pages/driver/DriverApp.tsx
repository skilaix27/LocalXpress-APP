import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop, DriverLocation } from '@/lib/supabase-types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Phone,
  FileText,
  Package,
  CheckCircle,
  User,
  LogOut,
  ChevronUp,
} from 'lucide-react';

export default function DriverApp() {
  const { profile, signOut } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  // Fetch assigned stops
  const fetchStops = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('driver_id', profile.id)
        .neq('status', 'delivered')
        .order('created_at', { ascending: true });

      if (data) {
        setStops(data as Stop[]);
        if (!selectedStop && data.length > 0) {
          setSelectedStop(data[0] as Stop);
        }
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update location
  const updateLocation = async (lat: number, lng: number) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: profile.id,
          lat,
          lng,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(loc);
        updateLocation(loc.lat, loc.lng);
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Set Barcelona center as fallback
        setCurrentLocation({ lat: 41.3851, lng: 2.1734 });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile]);

  // Fetch stops on mount
  useEffect(() => {
    fetchStops();

    // Realtime subscription
    const channel = supabase
      .channel('driver-stops')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stops' },
        () => fetchStops()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Update stop status
  const updateStopStatus = async (status: 'picked' | 'delivered') => {
    if (!selectedStop) return;

    setUpdating(true);
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'picked') {
        updateData.picked_at = new Date().toISOString();
      } else if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('stops')
        .update(updateData)
        .eq('id', selectedStop.id);

      if (error) throw error;

      toast.success(
        status === 'picked' ? '¡Paquete recogido!' : '¡Entrega completada!',
        { description: selectedStop.client_name }
      );

      // Refresh and select next stop
      await fetchStops();
      
      if (status === 'delivered') {
        const nextStop = stops.find((s) => s.id !== selectedStop.id);
        setSelectedStop(nextStop || null);
      } else {
        setSelectedStop({ ...selectedStop, status: 'picked' });
      }
    } catch (error: any) {
      toast.error('Error al actualizar', { description: error.message });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando rutas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{profile?.full_name}</p>
            <p className="text-xs text-secondary-foreground/70">
              {stops.length} paradas pendientes
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <DeliveryMap
          stops={selectedStop ? [selectedStop] : []}
          driverLocations={
            currentLocation && profile
              ? [
                  {
                    id: 'current',
                    driver_id: profile.id,
                    lat: currentLocation.lat,
                    lng: currentLocation.lng,
                    heading: null,
                    speed: null,
                    updated_at: new Date().toISOString(),
                    driver: profile,
                  },
                ]
              : []
          }
          showRoute={true}
          centerOn={currentLocation}
          className="h-full"
        />

        {/* Stop pills */}
        <div className="absolute top-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
          {stops.map((stop, i) => (
            <motion.button
              key={stop.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedStop(stop)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium shadow-md transition-all ${
                selectedStop?.id === stop.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground'
              }`}
            >
              #{i + 1} {stop.client_name.split(' ')[0]}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedStop && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="bg-card rounded-t-3xl shadow-float -mt-6 relative z-10"
          >
            {/* Handle */}
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="absolute left-1/2 -translate-x-1/2 -top-3 p-2"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </button>

            <div className="p-4 pt-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedStop.client_name}</h2>
                    <StatusBadge status={selectedStop.status} />
                  </div>
                  {selectedStop.client_phone && (
                    <a
                      href={`tel:${selectedStop.client_phone}`}
                      className="text-sm text-primary flex items-center gap-1 mt-1"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedStop.client_phone}
                    </a>
                  )}
                </div>
                <motion.div
                  animate={{ rotate: detailsExpanded ? 180 : 0 }}
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="p-2 cursor-pointer"
                >
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </div>

              {/* Expandable Details */}
              <AnimatePresence>
                {detailsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 mb-4 overflow-hidden"
                  >
                    {/* Pickup */}
                    <Card className="border-l-4 border-l-primary">
                      <CardContent className="p-3 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">RECOGIDA</p>
                          <p className="text-sm">{selectedStop.pickup_address}</p>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.pickup_lat},${selectedStop.pickup_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-full bg-primary/10 text-primary"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      </CardContent>
                    </Card>

                    {/* Delivery */}
                    <Card className="border-l-4 border-l-status-delivered">
                      <CardContent className="p-3 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-status-delivered shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">ENTREGA</p>
                          <p className="text-sm">{selectedStop.delivery_address}</p>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.delivery_lat},${selectedStop.delivery_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-full bg-status-delivered/10 text-status-delivered"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      </CardContent>
                    </Card>

                    {/* Notes */}
                    {selectedStop.client_notes && (
                      <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">{selectedStop.client_notes}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedStop.status === 'pending' && (
                  <Button
                    onClick={() => updateStopStatus('picked')}
                    disabled={updating}
                    className="flex-1 h-14 text-base gap-2 bg-status-picked hover:bg-status-picked/90 text-white"
                  >
                    <Package className="w-5 h-5" />
                    {updating ? 'Actualizando...' : 'Recogido'}
                  </Button>
                )}
                {selectedStop.status === 'picked' && (
                  <Button
                    onClick={() => updateStopStatus('delivered')}
                    disabled={updating}
                    className="flex-1 h-14 text-base gap-2 bg-status-delivered hover:bg-status-delivered/90 text-white"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {updating ? 'Actualizando...' : 'Entregado'}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No stops message */}
      {stops.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">¡Todo entregado!</h2>
            <p className="text-muted-foreground">
              No tienes paradas asignadas en este momento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
