import { useState, useEffect, forwardRef, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryProofDialog } from '@/components/driver/DeliveryProofDialog';
import { Button } from '@/components/ui/button';
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
  ChevronUp,
  ChevronDown,
  X,
  Route,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SheetState = 'collapsed' | 'half' | 'full';

export default function DriverApp() {
  const { profile, signOut } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'active' | 'denied' | 'unavailable'>('loading');
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartState = useRef<SheetState>('half');

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
        if (selectedStop) {
          const updated = typedData.find(s => s.id === selectedStop.id);
          if (updated) setSelectedStop(updated);
          else setSelectedStop(null);
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
        setMapCenter(prev => prev === null ? loc : prev);
        setGpsStatus('active');
        updateLocation(loc.lat, loc.lng);
      },
      (error) => {
        if (error.code === 1) {
          setGpsStatus('denied');
          toast.error('Ubicación denegada', { description: 'Activa la ubicación en ajustes.', duration: 8000 });
        } else if (error.code === 2) {
          setGpsStatus('unavailable');
        }
        setCurrentLocation({ lat: 41.3851, lng: 2.1734 });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
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

  const selectStop = (stop: Stop) => {
    setSelectedStop(stop);
    setMapCenter({ lat: stop.pickup_lat, lng: stop.pickup_lng });
    setSheetState('half');
  };

  const clearSelection = () => {
    setSelectedStop(null);
    setSheetState('half');
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
          <NavTriggerButton className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-transform">
            <Navigation className="w-3.5 h-3.5" />
            {label}
          </NavTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[180px]">
          <DropdownMenuItem asChild>
            <a href={urls.google} target="_blank" rel="noopener noreferrer" className="flex items-center py-2.5">
              <Map className="w-4 h-4 mr-2.5" /> Google Maps
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={urls.waze} target="_blank" rel="noopener noreferrer" className="flex items-center py-2.5">
              <Navigation className="w-4 h-4 mr-2.5" /> Waze
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={urls.apple} target="_blank" rel="noopener noreferrer" className="flex items-center py-2.5">
              <MapPin className="w-4 h-4 mr-2.5" /> Apple Maps
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Sheet height based on state
  const getSheetHeight = () => {
    switch (sheetState) {
      case 'collapsed': return 'h-[80px]';
      case 'half': return 'h-[45dvh]';
      case 'full': return 'h-[85dvh]';
    }
  };

  // Touch drag for sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartState.current = sheetState;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = dragStartY.current - e.changedTouches[0].clientY;
    const threshold = 50;

    if (deltaY > threshold) {
      // Swiped up
      if (dragStartState.current === 'collapsed') setSheetState('half');
      else if (dragStartState.current === 'half') setSheetState('full');
    } else if (deltaY < -threshold) {
      // Swiped down
      if (dragStartState.current === 'full') setSheetState('half');
      else if (dragStartState.current === 'half') setSheetState('collapsed');
    }
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
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
      {/* Floating header */}
      <header className="absolute top-0 left-0 right-0 z-30 safe-area-top">
        <div className="mx-3 mt-2 bg-secondary/95 backdrop-blur-md text-secondary-foreground rounded-2xl px-3 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-xs leading-tight">{profile?.full_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-secondary-foreground/70">{stops.length} paradas</span>
                {gpsStatus === 'active' && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  </span>
                )}
                {gpsStatus === 'denied' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                    <AlertCircle className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Summary pills */}
            <div className="flex gap-1 mr-1">
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingCount}P</span>
              <span className="bg-amber-500/20 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{pickedCount}R</span>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-secondary-foreground/70">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <DeliveryMap
          stops={stops}
          driverLocations={
            currentLocation && profile
              ? [{ id: 'current', driver_id: profile.id, lat: currentLocation.lat, lng: currentLocation.lng, heading: null, speed: null, updated_at: new Date().toISOString(), driver: profile }]
              : []
          }
          selectedStopId={selectedStop?.id}
          onStopClick={selectStop}
          showRoute={!!selectedStop}
          centerOn={mapCenter}
          className="h-full w-full"
        />
      </div>

      {/* Re-center button */}
      {gpsStatus === 'active' && (
        <button
          onClick={() => currentLocation && setMapCenter({ ...currentLocation })}
          className="absolute z-20 right-3 bottom-[calc(45dvh+12px)] w-10 h-10 bg-card rounded-full shadow-lg flex items-center justify-center border active:scale-95 transition-all"
          style={{ bottom: sheetState === 'collapsed' ? '92px' : sheetState === 'half' ? 'calc(45dvh + 12px)' : 'calc(85dvh + 12px)' }}
        >
          <Locate className="w-5 h-5 text-primary" />
        </button>
      )}

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card rounded-t-2xl shadow-[0_-4px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out flex flex-col ${getSheetHeight()}`}
      >
        {/* Drag handle */}
        <div
          className="py-3 cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSheetState(prev => prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'half')}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
        </div>

        <AnimatePresence mode="wait">
          {selectedStop ? (
            /* ===== DETAIL VIEW ===== */
            <motion.div
              key={`detail-${selectedStop.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-4 pb-6"
            >
              {/* Back button + client */}
              <div className="flex items-center gap-3 mb-3">
                <button onClick={clearSelection} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold truncate">{selectedStop.client_name}</h2>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedStop.status} className="text-[10px] px-2 py-0.5" />
                    {selectedStop.scheduled_pickup_at && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Clock className="w-3 h-3" />
                        {format(new Date(selectedStop.scheduled_pickup_at), "HH:mm", { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                {selectedStop.client_phone && (
                  <a href={`tel:${selectedStop.client_phone}`} className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 active:scale-95">
                    <Phone className="w-4 h-4 text-primary" />
                  </a>
                )}
              </div>

              {/* Pickup address */}
              <div className="bg-muted/50 rounded-xl p-3 mb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-primary tracking-wider mb-0.5">📦 RECOGIDA</p>
                    <p className="text-sm leading-snug">{selectedStop.pickup_address}</p>
                  </div>
                  <NavigateButton lat={selectedStop.pickup_lat} lng={selectedStop.pickup_lng} label="Ir" />
                </div>
              </div>

              {/* Delivery address */}
              <div className="bg-muted/50 rounded-xl p-3 mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-green-600 tracking-wider mb-0.5">🏠 ENTREGA</p>
                    <p className="text-sm leading-snug">{selectedStop.delivery_address}</p>
                  </div>
                  <NavigateButton lat={selectedStop.delivery_lat} lng={selectedStop.delivery_lng} label="Ir" />
                </div>
              </div>

              {/* Distance + notes */}
              <div className="flex items-center gap-2 mb-3">
                {selectedStop.distance_km != null && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                    <Route className="w-3 h-3" /> {selectedStop.distance_km} km
                  </span>
                )}
                {selectedStop.client_notes && (
                  <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded-full">
                    <FileText className="w-3 h-3" /> {selectedStop.client_notes}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {selectedStop.status === 'pending' && (
                  <Button
                    onClick={markAsPicked}
                    disabled={updating}
                    className="flex-1 h-12 text-sm gap-2 rounded-xl font-bold active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: 'hsl(45 93% 47%)', color: '#fff' }}
                  >
                    <Package className="w-4 h-4" />
                    {updating ? 'Actualizando...' : 'Recogido ✓'}
                  </Button>
                )}
                {selectedStop.status === 'picked' && (
                  <Button
                    onClick={() => setProofDialogOpen(true)}
                    className="flex-1 h-12 text-sm gap-2 rounded-xl font-bold active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: 'hsl(142 71% 45%)', color: '#fff' }}
                  >
                    <Camera className="w-4 h-4" />
                    Entregar con foto
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            /* ===== LIST VIEW ===== */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-4 pb-6"
            >
              {/* Collapsed: just show count */}
              {sheetState === 'collapsed' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{stops.length} paradas pendientes</span>
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">
                    PARADAS ORDENADAS POR HORA
                  </p>
                  <div className="space-y-2">
                    {stops.map((stop, i) => (
                      <button
                        key={stop.id}
                        onClick={() => selectStop(stop)}
                        className="w-full text-left bg-background border rounded-xl p-3 active:bg-muted/60 transition-colors flex items-center gap-3"
                      >
                        {/* Order badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          stop.status === 'picked'
                            ? 'bg-amber-500 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          {i + 1}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-semibold text-sm truncate">{stop.client_name}</span>
                            <StatusBadge status={stop.status} className="text-[9px] px-1.5 py-0" />
                          </div>
                          {stop.scheduled_pickup_at && (
                            <span className="flex items-center gap-1 text-xs text-primary font-medium">
                              <Clock className="w-3 h-3" />
                              {format(new Date(stop.scheduled_pickup_at), "HH:mm")}
                            </span>
                          )}
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {stop.status === 'pending' ? stop.pickup_address : stop.delivery_address}
                          </p>
                        </div>

                        {/* Distance */}
                        {stop.distance_km != null && (
                          <span className="text-[10px] text-muted-foreground font-medium shrink-0">{stop.distance_km}km</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {stops.length === 0 && (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Package className="w-7 h-7 text-primary" />
                      </div>
                      <h2 className="text-lg font-bold mb-1">¡Todo entregado!</h2>
                      <p className="text-sm text-muted-foreground">No tienes paradas asignadas.</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
