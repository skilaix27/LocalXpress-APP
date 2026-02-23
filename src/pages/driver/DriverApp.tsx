import { useState, useEffect, forwardRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryProofDialog } from '@/components/driver/DeliveryProofDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  Map,
  Locate,
  AlertCircle,
  Clock,
  ArrowLeft,
  List,
  ChevronRight,
  Route,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewMode = 'list' | 'detail';

export default function DriverApp() {
  const { profile, signOut } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'active' | 'denied' | 'unavailable'>('loading');

  const fetchStops = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('driver_id', profile.id)
        .neq('status', 'delivered');

      if (data) {
        const typedData = (data as Stop[]).sort((a, b) => {
          const aTime = a.scheduled_pickup_at ? new Date(a.scheduled_pickup_at).getTime() : null;
          const bTime = b.scheduled_pickup_at ? new Date(b.scheduled_pickup_at).getTime() : null;
          if (aTime && bTime) return aTime - bTime;
          if (aTime && !bTime) return -1;
          if (!aTime && bTime) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setStops(typedData);
        // Update selected stop data if viewing detail
        if (selectedStop) {
          const updated = typedData.find(s => s.id === selectedStop.id);
          if (updated) setSelectedStop(updated);
          else if (viewMode === 'detail') {
            setViewMode('list');
            setSelectedStop(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedStop, viewMode]);

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
            description: 'Activa la ubicación en los ajustes de tu navegador.',
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

  const openStopDetail = (stop: Stop) => {
    setSelectedStop(stop);
    setViewMode('detail');
  };

  const goBackToList = () => {
    setViewMode('list');
  };

  const getNavUrls = (lat: number, lng: number) => ({
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
  });

  const NavTriggerButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    (props, ref) => <button ref={ref} {...props} />
  );

  const NavigateButton = ({ lat, lng, label }: { lat: number; lng: number; label: string }) => {
    const urls = getNavUrls(lat, lng);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <NavTriggerButton className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform w-full justify-center">
            <Navigation className="w-4 h-4" />
            {label}
          </NavTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[200px]">
          <DropdownMenuItem asChild>
            <a href={urls.google} target="_blank" rel="noopener noreferrer" className="flex items-center py-3">
              <Map className="w-5 h-5 mr-3" /> Google Maps
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={urls.waze} target="_blank" rel="noopener noreferrer" className="flex items-center py-3">
              <Navigation className="w-5 h-5 mr-3" /> Waze
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={urls.apple} target="_blank" rel="noopener noreferrer" className="flex items-center py-3">
              <MapPin className="w-5 h-5 mr-3" /> Apple Maps
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const pendingCount = stops.filter(s => s.status === 'pending').length;
  const pickedCount = stops.filter(s => s.status === 'picked').length;

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
          {viewMode === 'detail' ? (
            <button onClick={goBackToList} className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center active:scale-95 transition-transform">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm leading-tight">
              {viewMode === 'detail' ? selectedStop?.client_name : profile?.full_name}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-secondary-foreground/70">
                {viewMode === 'detail' ? 'Detalle de parada' : `${stops.length} paradas`}
              </p>
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
        <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Summary stats */}
            <div className="px-4 py-3 flex gap-2 shrink-0">
              <div className="flex-1 bg-muted rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">PENDIENTES</p>
              </div>
              <div className="flex-1 bg-status-picked-bg rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-status-picked">{pickedCount}</p>
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">RECOGIDOS</p>
              </div>
              <div className="flex-1 bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{stops.length}</p>
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">TOTAL</p>
              </div>
            </div>

            {/* Map preview with all stops */}
            <div className="px-4 pb-3 shrink-0">
              <div className="h-40 rounded-xl overflow-hidden border relative">
                <DeliveryMap
                  stops={stops}
                  driverLocations={
                    currentLocation && profile
                      ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
                      : []
                  }
                  showRoute={false}
                  className="h-full"
                />
                <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 shadow-sm border">
                  <Route className="w-3.5 h-3.5 text-primary" />
                  {stops.length} paradas
                </div>
              </div>
            </div>

            {/* Stop list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {stops.map((stop, i) => (
                <motion.div
                  key={stop.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <button
                    onClick={() => openStopDetail(stop)}
                    className="w-full text-left bg-card border rounded-xl p-3.5 active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Order number */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                        stop.status === 'picked' 
                          ? 'bg-status-picked text-white' 
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {i + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Client & status */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">{stop.client_name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StatusBadge status={stop.status} className="text-[10px] px-2 py-0.5" />
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Scheduled time */}
                        {stop.scheduled_pickup_at && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium mb-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(stop.scheduled_pickup_at), "d MMM · HH:mm", { locale: es })}
                          </div>
                        )}

                        {/* Addresses */}
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {stop.pickup_address}
                          </p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-delivered shrink-0" />
                            {stop.delivery_address}
                          </p>
                        </div>

                        {/* Distance */}
                        {stop.distance_km != null && (
                          <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                            {stop.distance_km} km
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Empty state */}
            {stops.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">¡Todo entregado!</h2>
                  <p className="text-muted-foreground">No tienes paradas asignadas.</p>
                </div>
              </div>
            )}
          </motion.div>
        ) : selectedStop ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Map for selected stop */}
            <div className="h-[35dvh] relative shrink-0">
              <DeliveryMap
                stops={[selectedStop]}
                driverLocations={
                  currentLocation && profile
                    ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
                    : []
                }
                showRoute={true}
                centerOn={mapCenter}
                className="h-full"
              />
              {gpsStatus === 'active' && (
                <button
                  onClick={() => currentLocation && setMapCenter({ ...currentLocation })}
                  className="absolute bottom-3 left-3 w-10 h-10 bg-card rounded-full shadow-lg flex items-center justify-center border active:scale-95 transition-transform z-10"
                >
                  <Locate className="w-5 h-5 text-primary" />
                </button>
              )}
            </div>

            {/* Stop detail card */}
            <div className="flex-1 overflow-y-auto -mt-4 relative z-10">
              <div className="bg-card rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-5 pb-6 min-h-full">
                {/* Status & time */}
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={selectedStop.status} />
                  {selectedStop.scheduled_pickup_at && (
                    <div className="flex items-center gap-1.5 text-sm text-primary font-semibold">
                      <Clock className="w-4 h-4" />
                      {format(new Date(selectedStop.scheduled_pickup_at), "d MMM · HH:mm", { locale: es })}
                    </div>
                  )}
                </div>

                {/* Client info */}
                <div className="mb-4">
                  <h2 className="text-lg font-bold">{selectedStop.client_name}</h2>
                  {selectedStop.client_phone && (
                    <a href={`tel:${selectedStop.client_phone}`} className="text-sm text-primary flex items-center gap-1 mt-1 active:opacity-70">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedStop.client_phone}
                    </a>
                  )}
                </div>

                {/* Addresses with navigation */}
                <div className="space-y-3 mb-4">
                  <Card className="border-l-4 border-l-primary">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">RECOGIDA</p>
                      <p className="text-sm leading-snug mb-2">{selectedStop.pickup_address}</p>
                      <NavigateButton lat={selectedStop.pickup_lat} lng={selectedStop.pickup_lng} label="Ir a recoger" />
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-status-delivered">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">ENTREGA</p>
                      <p className="text-sm leading-snug mb-2">{selectedStop.delivery_address}</p>
                      <NavigateButton lat={selectedStop.delivery_lat} lng={selectedStop.delivery_lng} label="Ir a entregar" />
                    </CardContent>
                  </Card>
                </div>

                {/* Distance */}
                {selectedStop.distance_km != null && (
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-primary/10 rounded-xl text-sm mb-4">
                    <Route className="w-4 h-4 text-primary" />
                    <span className="text-primary font-bold">{selectedStop.distance_km} km</span>
                    <span className="text-muted-foreground">en coche</span>
                  </div>
                )}

                {/* Notes */}
                {selectedStop.client_notes && (
                  <div className="flex items-start gap-2 p-3 bg-muted rounded-xl mb-4">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{selectedStop.client_notes}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 mt-auto">
                  {selectedStop.status === 'pending' && (
                    <Button
                      onClick={markAsPicked}
                      disabled={updating}
                      className="flex-1 h-14 text-base gap-2 bg-status-picked hover:bg-status-picked/90 active:scale-[0.98] transition-transform text-white rounded-xl"
                    >
                      <Package className="w-5 h-5" />
                      {updating ? 'Actualizando...' : 'Marcar Recogido'}
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

                {/* Back to list button */}
                <button
                  onClick={goBackToList}
                  className="w-full mt-3 py-3 text-sm text-muted-foreground flex items-center justify-center gap-1.5 active:text-foreground transition-colors"
                >
                  <List className="w-4 h-4" />
                  Ver todas las paradas
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
