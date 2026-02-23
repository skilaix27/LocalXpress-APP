import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryProofDialog } from '@/components/driver/DeliveryProofDialog';
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
  Camera,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  Clock,
  Map,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DriverApp() {
  const { profile, signOut } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

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
        const typedData = data as Stop[];
        setStops(typedData);
        if (!selectedStop || !typedData.find(s => s.id === selectedStop.id)) {
          setSelectedStop(typedData[0] || null);
        }
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async (lat: number, lng: number) => {
    if (!profile) return;
    try {
      await supabase.from('driver_locations').upsert(
        { driver_id: profile.id, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: 'driver_id' }
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(loc);
        updateLocation(loc.lat, loc.lng);
      },
      () => setCurrentLocation({ lat: 41.3851, lng: 2.1734 }),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile]);

  useEffect(() => {
    fetchStops();
    const channel = supabase
      .channel('driver-stops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => fetchStops())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const markAsPicked = async () => {
    if (!selectedStop) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('stops')
        .update({ status: 'picked', picked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', selectedStop.id);
      if (error) throw error;
      toast.success('¡Paquete recogido!', { description: selectedStop.client_name });
      setSelectedStop({ ...selectedStop, status: 'picked' });
      fetchStops();
    } catch (error: any) {
      toast.error('Error al actualizar', { description: error.message });
    } finally {
      setUpdating(false);
    }
  };

  const openNavigation = (lat: number, lng: number, app: 'google' | 'waze' | 'apple') => {
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    };
    window.open(urls[app], '_blank');
  };

  const NavigateButton = ({ lat, lng, color }: { lat: number; lng: number; color: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`p-2 rounded-full ${color} shrink-0`}>
          <Navigation className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={() => openNavigation(lat, lng, 'google')}>
          <Map className="w-4 h-4 mr-2" /> Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNavigation(lat, lng, 'waze')}>
          <Navigation className="w-4 h-4 mr-2" /> Waze
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNavigation(lat, lng, 'apple')}>
          <MapPin className="w-4 h-4 mr-2" /> Apple Maps
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const currentStop = stops.find(s => s.status === 'picked') || stops.find(s => s.status === 'pending');
  const queueStops = stops.filter(s => s.id !== currentStop?.id);

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
            <p className="text-xs text-secondary-foreground/70">{stops.length} paradas pendientes</p>
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
              ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
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
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-card rounded-t-3xl shadow-float -mt-6 relative z-10">
            <button onClick={() => setDetailsExpanded(!detailsExpanded)} className="absolute left-1/2 -translate-x-1/2 -top-3 p-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </button>

            <div className="p-4 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedStop.client_name}</h2>
                    <StatusBadge status={selectedStop.status} />
                  </div>
                  {selectedStop.client_phone && (
                    <a href={`tel:${selectedStop.client_phone}`} className="text-sm text-primary flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {selectedStop.client_phone}
                    </a>
                  )}
                </div>
                <motion.div animate={{ rotate: detailsExpanded ? 180 : 0 }} onClick={() => setDetailsExpanded(!detailsExpanded)} className="p-2 cursor-pointer">
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </div>

              <AnimatePresence>
                {detailsExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 mb-4 overflow-hidden">
                    <Card className="border-l-4 border-l-primary">
                      <CardContent className="p-3 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">RECOGIDA</p>
                          <p className="text-sm">{selectedStop.pickup_address}</p>
                        </div>
                        <NavigateButton lat={selectedStop.pickup_lat} lng={selectedStop.pickup_lng} color="bg-primary/10 text-primary" />
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-status-delivered">
                      <CardContent className="p-3 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-status-delivered shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">ENTREGA</p>
                          <p className="text-sm">{selectedStop.delivery_address}</p>
                        </div>
                        <NavigateButton lat={selectedStop.delivery_lat} lng={selectedStop.delivery_lng} color="bg-status-delivered/10 text-status-delivered" />
                      </CardContent>
                    </Card>

                    {selectedStop.client_notes && (
                      <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">{selectedStop.client_notes}</p>
                      </div>
                    )}

                    {/* Queue */}
                    {queueStops.length > 0 && (
                      <button onClick={() => setShowQueue(!showQueue)} className="w-full flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                        <span className="font-medium">{queueStops.length} paradas más en cola</span>
                        {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}

                    <AnimatePresence>
                      {showQueue && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden">
                          {queueStops.map((stop, i) => (
                            <button
                              key={stop.id}
                              onClick={() => { setSelectedStop(stop); setShowQueue(false); }}
                              className="w-full p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-muted rounded-full w-6 h-6 flex items-center justify-center font-medium">
                                    {i + 2}
                                  </span>
                                  <span className="font-medium text-sm">{stop.client_name}</span>
                                </div>
                                <StatusBadge status={stop.status} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 pl-8 truncate">{stop.delivery_address}</p>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {selectedStop.status === 'pending' && (
                  <Button
                    onClick={markAsPicked}
                    disabled={updating}
                    className="flex-1 h-14 text-base gap-2 bg-status-picked hover:bg-status-picked/90 text-white"
                  >
                    <Package className="w-5 h-5" />
                    {updating ? 'Actualizando...' : 'Recogido'}
                  </Button>
                )}
                {selectedStop.status === 'picked' && (
                  <Button
                    onClick={() => setProofDialogOpen(true)}
                    className="flex-1 h-14 text-base gap-2 bg-status-delivered hover:bg-status-delivered/90 text-white"
                  >
                    <Camera className="w-5 h-5" />
                    Entregar con foto
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No stops */}
      {stops.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">¡Todo entregado!</h2>
            <p className="text-muted-foreground">No tienes paradas asignadas en este momento.</p>
          </div>
        </div>
      )}

      {/* Proof Dialog */}
      {selectedStop && (
        <DeliveryProofDialog
          stop={selectedStop}
          open={proofDialogOpen}
          onOpenChange={setProofDialogOpen}
          onSuccess={fetchStops}
        />
      )}
    </div>
  );
}
