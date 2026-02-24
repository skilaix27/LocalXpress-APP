import { useState, useEffect, forwardRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryProofDialog } from '@/components/driver/DeliveryProofDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { getDeliveryZone, adjustDistance } from '@/lib/delivery-zones';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DriverStopsList } from '@/components/driver/DriverStopsList';
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
  Map,
  Locate,
  AlertCircle,
  Clock,
  List,
  ArrowLeft,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DriverApp() {
  const { profile, signOut } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'active' | 'denied' | 'unavailable'>('loading');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const fetchStops = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('driver_id', profile.id)
        .neq('status', 'delivered');

      if (data) {
        // Sort: stops with scheduled time first (closest deadline first), then unscheduled by created_at
        const typedData = (data as any[]).sort((a, b) => {
          const aTime = a.scheduled_pickup_at ? new Date(a.scheduled_pickup_at).getTime() : null;
          const bTime = b.scheduled_pickup_at ? new Date(b.scheduled_pickup_at).getTime() : null;
          if (aTime && bTime) return aTime - bTime;
          if (aTime && !bTime) return -1;
          if (!aTime && bTime) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }) as Stop[];
        setStops(typedData);
        if (typedData.length <= 1) {
          setViewMode('detail');
        }
        if (!selectedStop || !typedData.find(s => s.id === selectedStop.id)) {
          setSelectedStop(typedData[0] || null);
        }
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedStop]);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!profile) return;
    try {
      await supabase.from('driver_locations').upsert(
        { driver_id: profile.id, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: 'driver_id' }
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, [profile]);

  // GPS tracking with better error handling
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      setCurrentLocation({ lat: 41.3851, lng: 2.1734 });
      return;
    }

    setGpsStatus('loading');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(loc);
        // Only center map on first GPS fix
        setMapCenter(prev => prev === null ? loc : prev);
        setGpsStatus('active');
        updateLocation(loc.lat, loc.lng);
      },
      (error) => {
        console.warn('GPS error:', error.code, error.message);
        if (error.code === 1) {
          setGpsStatus('denied');
          toast.error('Ubicación denegada', {
            description: 'Activa la ubicación en los ajustes de tu navegador para usar la app correctamente.',
            duration: 8000,
          });
        } else if (error.code === 2) {
          setGpsStatus('unavailable');
        }
        // Fallback to Barcelona center
        setCurrentLocation({ lat: 41.3851, lng: 2.1734 });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile, updateLocation]);

  useEffect(() => {
    fetchStops();
    const channel = supabase
      .channel('driver-stops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => fetchStops())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, fetchStops]);

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

  const getNavUrls = (lat: number, lng: number) => {
    const origin = currentLocation
      ? `${currentLocation.lat},${currentLocation.lng}`
      : '';
    return {
      google: origin
        ? `https://www.google.com/maps/dir/${origin}/${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: origin
        ? `https://maps.apple.com/?saddr=${origin}&daddr=${lat},${lng}&dirflg=d`
        : `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    };
  };

  const openNavLink = (url: string) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const NavTriggerButton = forwardRef<HTMLButtonElement, { className?: string; children?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
    (props, ref) => <button ref={ref} {...props} />
  );

  const NavigateButton = ({ lat, lng, color }: { lat: number; lng: number; color: string }) => {
    const urls = getNavUrls(lat, lng);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <NavTriggerButton className={`p-3 rounded-full ${color} shrink-0 active:scale-95 transition-transform`}>
            <Navigation className="w-5 h-5" />
          </NavTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem onClick={() => openNavLink(urls.google)} className="flex items-center py-3 cursor-pointer">
            <Map className="w-5 h-5 mr-3" /> Google Maps
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openNavLink(urls.waze)} className="flex items-center py-3 cursor-pointer">
            <Navigation className="w-5 h-5 mr-3" /> Waze
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openNavLink(urls.apple)} className="flex items-center py-3 cursor-pointer">
            <MapPin className="w-5 h-5 mr-3" /> Apple Maps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const handleSelectStop = (stop: Stop) => {
    setSelectedStop(stop);
    setViewMode('detail');
  };

  const currentStop = stops.find(s => s.status === 'picked') || stops.find(s => s.status === 'assigned') || stops.find(s => s.status === 'pending');
  const queueStops = stops.filter(s => s.id !== currentStop?.id);

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando rutas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground px-4 py-2.5 flex items-center justify-between z-20 shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          {viewMode === 'detail' && stops.length > 1 && (
            <button onClick={() => setViewMode('list')} className="p-1.5 -ml-1.5 rounded-lg active:bg-secondary-foreground/10">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{profile?.full_name}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-secondary-foreground/70">{stops.length} paradas</p>
              {gpsStatus === 'active' && (
                <span className="flex items-center gap-0.5 text-xs text-secondary-foreground/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  GPS
                </span>
              )}
              {gpsStatus === 'denied' && (
                <span className="flex items-center gap-0.5 text-xs text-destructive">
                  <AlertCircle className="w-3 h-3" /> Sin GPS
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {viewMode === 'detail' && stops.length > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="h-9 w-9">
              <List className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* List View */}
      {viewMode === 'list' && stops.length > 1 ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Map with all stops */}
          <div className="h-[35dvh] shrink-0 relative">
            <DeliveryMap
              stops={stops}
              driverLocations={
                currentLocation && profile
                  ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
                  : []
              }
              showRoute={false}
              centerOn={null}
              onStopClick={handleSelectStop}
              className="h-full"
            />
          </div>
          <DriverStopsList stops={stops} onSelectStop={handleSelectStop} />
        </div>
      ) : (
      <>
      {/* Map - takes remaining space */}
      <div className="flex-1 relative min-h-0">
        <DeliveryMap
          stops={selectedStop ? [selectedStop] : []}
          driverLocations={
            currentLocation && profile
              ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
              : []
          }
          showRoute={true}
          centerOn={null}
          className="h-full"
        />

        {/* Stop pills - scrollable horizontally */}
        {stops.length > 1 && (
          <div className="absolute top-3 left-3 right-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {stops.map((stop, i) => (
              <motion.button
                key={stop.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedStop(stop)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all active:scale-95 ${
                  selectedStop?.id === stop.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground border'
                }`}
              >
                <span>#{i + 1} {stop.client_name.split(' ')[0]}</span>
                {(stop as any).scheduled_pickup_at && (
                  <span className="ml-1 opacity-80">
                    {format(new Date((stop as any).scheduled_pickup_at), 'HH:mm')}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Re-center button */}
        {gpsStatus === 'active' && (
          <button
            onClick={() => currentLocation && setMapCenter({ ...currentLocation })}
            className="absolute bottom-4 left-4 w-10 h-10 bg-card rounded-full shadow-lg flex items-center justify-center border active:scale-95 transition-transform z-10"
          >
            <Locate className="w-5 h-5 text-primary" />
          </button>
        )}
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedStop && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="bg-card rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] -mt-4 relative z-20 shrink-0 safe-area-bottom max-h-[55dvh] overflow-y-auto"
          >
            {/* Drag handle */}
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full flex justify-center pt-2.5 pb-1"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </button>

            <div className="px-4 pb-4">
              {/* Stop header */}
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold truncate">{selectedStop.client_name}</h2>
                    <StatusBadge status={selectedStop.status} />
                  </div>
                  {(selectedStop as any).scheduled_pickup_at && (
                    <div className="flex items-center gap-1 mt-0.5 text-sm text-primary font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date((selectedStop as any).scheduled_pickup_at), "d MMM · HH:mm", { locale: es })}
                    </div>
                  )}
                  {selectedStop.client_phone && (
                    <a href={`tel:${selectedStop.client_phone}`} className="text-sm text-primary flex items-center gap-1 mt-0.5 active:opacity-70">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedStop.client_phone}
                    </a>
                  )}
                </div>
                <motion.button
                  animate={{ rotate: detailsExpanded ? 180 : 0 }}
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="p-2 -mr-2"
                >
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>

              <AnimatePresence>
                {detailsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2.5 mb-3 overflow-hidden"
                  >
                    {/* Pickup */}
                    <Card className="border-l-4 border-l-primary">
                      <CardContent className="p-3 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-muted-foreground tracking-wider">RECOGIDA</p>
                          <p className="text-sm leading-snug truncate">{selectedStop.pickup_address}</p>
                        </div>
                        <NavigateButton lat={selectedStop.pickup_lat} lng={selectedStop.pickup_lng} color="bg-primary/10 text-primary" />
                      </CardContent>
                    </Card>

                    {/* Delivery */}
                    <Card className="border-l-4 border-l-status-delivered">
                      <CardContent className="p-3 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-status-delivered shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-muted-foreground tracking-wider">ENTREGA</p>
                          <p className="text-sm leading-snug truncate">{selectedStop.delivery_address}</p>
                        </div>
                        <NavigateButton lat={selectedStop.delivery_lat} lng={selectedStop.delivery_lng} color="bg-status-delivered/10 text-status-delivered" />
                      </CardContent>
                    </Card>

                    {/* Distance */}
                    {selectedStop.distance_km != null && (
                      <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-primary/10 rounded-lg text-sm">
                        <span className="text-primary font-bold">{adjustDistance(selectedStop.distance_km)} km</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold">{getDeliveryZone(selectedStop.distance_km)}</span>
                      </div>
                    )}

                    {selectedStop.client_notes && (
                      <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">{selectedStop.client_notes}</p>
                      </div>
                    )}

                    {/* Queue */}
                    {queueStops.length > 0 && (
                      <button onClick={() => setShowQueue(!showQueue)} className="w-full flex items-center justify-between p-3 bg-muted rounded-lg text-sm active:bg-muted/70 transition-colors">
                        <span className="font-medium">{queueStops.length} paradas más</span>
                        {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}

                    <AnimatePresence>
                      {showQueue && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden">
                          {queueStops.map((stop, i) => (
                            <button
                              key={stop.id}
                              onClick={() => { setSelectedStop(stop); setShowQueue(false); }}
                              className="w-full p-3 rounded-lg border text-left active:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-muted rounded-full w-6 h-6 flex items-center justify-center font-bold">
                                    {i + 2}
                                  </span>
                                  <span className="font-medium text-sm">{stop.client_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(stop as any).scheduled_pickup_at && (
                                    <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" />
                                      {format(new Date((stop as any).scheduled_pickup_at), 'HH:mm')}
                                    </span>
                                  )}
                                  <StatusBadge status={stop.status} />
                                </div>
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

              {/* Action Buttons - large touch targets */}
              <div className="flex gap-3">
                {(selectedStop.status === 'pending' || selectedStop.status === 'assigned') && (
                  <Button
                    onClick={markAsPicked}
                    disabled={updating}
                    className="flex-1 h-14 text-base gap-2 bg-status-picked hover:bg-status-picked/90 active:scale-[0.98] transition-transform text-white rounded-xl"
                  >
                    <Package className="w-5 h-5" />
                    {updating ? 'Actualizando...' : 'Recogido'}
                  </Button>
                )}
                {selectedStop.status === 'picked' && (
                  <Button
                    onClick={() => setProofDialogOpen(true)}
                    className="flex-1 h-14 text-base gap-2 bg-status-delivered hover:bg-status-delivered/90 active:scale-[0.98] transition-transform text-white rounded-xl"
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
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-30">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">¡Todo entregado!</h2>
            <p className="text-muted-foreground">No tienes paradas asignadas.</p>
          </div>
        </div>
      )}
      </>
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
