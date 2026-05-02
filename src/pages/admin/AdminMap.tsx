import { useState, useEffect, useCallback } from 'react';
import { stopsApi, locationsApi } from '@/lib/api';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { StopDetailDialog } from '@/components/admin/StopDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Stop, DriverLocation } from '@/lib/supabase-types';
import { MapPin, RefreshCw, Locate, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAdminData } from '@/hooks/useAdminData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    !Number.isNaN(lat) && !Number.isNaN(lng) &&
    isFinite(lat) && isFinite(lng)
  );
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, 'yyyy-MM-dd');
}

type DateMode = 'today' | 'tomorrow' | 'custom' | 'all';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMap() {
  const { toast } = useToast();

  // Date filter
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState<string>(todayStr());

  // Data
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  // Dialog
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showNoCoords, setShowNoCoords] = useState(false);

  // Driver locations come from useAdminData (still polling)
  const { driverLocations, drivers, fetchData: refreshAdmin } = useAdminData({ poll: false });

  // ─── Fetch stops ────────────────────────────────────────────────────────────

  const fetchStops = useCallback(async () => {
    setLoading(true);
    try {
      let dateParam: Record<string, string> = {};
      if (dateMode === 'today')    dateParam = { date: todayStr() };
      if (dateMode === 'tomorrow') dateParam = { date: tomorrowStr() };
      if (dateMode === 'custom' && customDate) dateParam = { date: customDate };
      // 'all' → no date filter

      // Fetch all pages up to 500 stops (map doesn't need more)
      const res = await stopsApi.list({ limit: 500, ...dateParam }) as {
        data: Stop[]; total: number; totalPages: number;
      };
      setStops(res.data ?? []);
    } catch (err) {
      console.error('[AdminMap] fetchStops error:', err);
      setStops([]);
    } finally {
      setLoading(false);
    }
  }, [dateMode, customDate]);

  useEffect(() => { fetchStops(); }, [fetchStops]);

  // ─── Geocode missing ────────────────────────────────────────────────────────

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      // Pass the current date filter so geocoding targets only visible stops
      const params =
        dateMode === 'all'    ? { all: true } :
        dateMode === 'today'  ? { date: todayStr() } :
        dateMode === 'tomorrow' ? { date: tomorrowStr() } :
        customDate ? { date: customDate } : {};

      const result = await stopsApi.geocodeMissing(params);
      const details = result.items?.length
        ? result.items.map(i => `${i.order_code ?? '?'}: recogida=${i.pickup_geocoded ? '✓' : '✗'} entrega=${i.delivery_geocoded ? '✓' : '✗'}`).join('\n')
        : undefined;
      toast({
        title: `Geocodificación: ${result.updated} actualizados, ${result.failed} fallidos`,
        description: details ?? `${result.processed} procesados`,
      });
      fetchStops();
    } catch (err: unknown) {
      toast({ title: 'Error al geocodificar', description: String(err), variant: 'destructive' });
    } finally {
      setGeocoding(false);
    }
  };

  // ─── Computed stats ─────────────────────────────────────────────────────────

  const activeStops = stops.filter((s) => s.status !== 'delivered');
  const stopsWithPickup   = activeStops.filter((s) => isValidCoord(s.pickup_lat, s.pickup_lng));
  const stopsWithDelivery = activeStops.filter((s) => isValidCoord(s.delivery_lat, s.delivery_lng));
  const stopsNoCoords     = activeStops.filter(
    (s) => !isValidCoord(s.pickup_lat, s.pickup_lng) && !isValidCoord(s.delivery_lat, s.delivery_lng),
  );

  // Two hours ago for active driver filter
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const activeDriverLocations = (driverLocations as DriverLocation[]).filter(
    (loc) => new Date(loc.updated_at).getTime() > twoHoursAgo,
  );

  const driverLocationsForMap = activeDriverLocations.map((loc) => ({
    ...loc,
    driver: drivers.find((d) => d.id === loc.driver_id) ?? undefined,
  }));

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* ─── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b bg-card shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Title + badge counts */}
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-bold whitespace-nowrap">Mapa</h1>
            <Badge variant="secondary" className="text-xs">{stopsWithPickup.length + stopsWithDelivery.length} pts</Badge>
          </div>

          {/* Date mode selector */}
          <div className="flex flex-1 flex-wrap gap-2 items-center">
            <Select value={dateMode} onValueChange={(v) => setDateMode(v as DateMode)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="tomorrow">Mañana</SelectItem>
                <SelectItem value="custom">Fecha concreta</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            {dateMode === 'custom' && (
              <Input
                type="date"
                className="w-36 h-8 text-sm"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}

            <Button size="sm" variant="outline" onClick={fetchStops} disabled={loading} className="h-8">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>

            <Button size="sm" variant="outline" onClick={handleGeocode} disabled={geocoding || loading} className="h-8">
              <Locate className={`w-3.5 h-3.5 mr-1.5 ${geocoding ? 'animate-spin' : ''}`} />
              Geocodificar faltantes
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          <span><span className="font-semibold text-orange-500">{stopsWithPickup.length}</span> recogidas visibles</span>
          <span>·</span>
          <span><span className="font-semibold text-emerald-600">{stopsWithDelivery.length}</span> entregas visibles</span>
          <span>·</span>
          <span><span className="font-semibold text-blue-600">{activeDriverLocations.length}</span> repartidores activos</span>
          {stopsNoCoords.length > 0 && (
            <>
              <span>·</span>
              <button
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700"
                onClick={() => setShowNoCoords(v => !v)}
              >
                <AlertTriangle className="w-3 h-3" />
                <span className="font-semibold">{stopsNoCoords.length}</span> sin coordenadas
                {showNoCoords ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>

        {/* Expandable list of stops without coords */}
        {showNoCoords && stopsNoCoords.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border rounded bg-amber-50 text-xs divide-y">
            {stopsNoCoords.map((s) => (
              <div key={s.id} className="px-3 py-1.5 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-amber-800">{s.order_code ?? s.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{s.client_name}</span>
                </div>
                <div className="text-muted-foreground">
                  {!isValidCoord(s.pickup_lat, s.pickup_lng) && <span className="text-orange-600">📦 {s.pickup_address}</span>}
                  {!isValidCoord(s.pickup_lat, s.pickup_lng) && !isValidCoord(s.delivery_lat, s.delivery_lng) && ' · '}
                  {!isValidCoord(s.delivery_lat, s.delivery_lng) && <span className="text-emerald-700">🏠 {s.delivery_address}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <DeliveryMap
          stops={activeStops}
          driverLocations={driverLocationsForMap}
          selectedStopId={selectedStop?.id}
          onStopClick={(stop) => { setSelectedStop(stop); setDetailOpen(true); }}
          showRoute={false}
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 pointer-events-none">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      <StopDetailDialog
        stop={selectedStop}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        drivers={drivers}
        onUpdate={() => { fetchStops(); refreshAdmin(); }}
      />
    </div>
  );
}
