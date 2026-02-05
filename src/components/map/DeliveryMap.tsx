import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Stop, DriverLocation, Profile } from '@/lib/supabase-types';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const createIcon = (color: string, isDriver = false) => {
  const size = isDriver ? 36 : 28;
  const svg = isDriver
    ? `<svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M8 12l2-2 2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>`
    : `<svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="white" stroke-width="1"/>
      </svg>`;

  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const pickupIcon = createIcon('#f97316'); // Orange
const deliveryIcon = createIcon('#22c55e'); // Green
const driverIcon = createIcon('#1e293b', true); // Slate

interface DeliveryMapProps {
  stops?: Stop[];
  driverLocations?: (DriverLocation & { driver?: Profile })[];
  selectedStopId?: string | null;
  onStopClick?: (stop: Stop) => void;
  showRoute?: boolean;
  centerOn?: { lat: number; lng: number } | null;
  className?: string;
}

export function DeliveryMap({
  stops = [],
  driverLocations = [],
  selectedStopId,
  onStopClick,
  showRoute = false,
  centerOn,
  className = '',
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Barcelona center
    const barcelonaCenter: [number, number] = [41.3851, 2.1734];

    mapInstanceRef.current = L.map(mapRef.current, {
      center: barcelonaCenter,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapInstanceRef.current);

    markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    // Add stop markers
    stops.forEach((stop) => {
      // Pickup marker
      const pickupMarker = L.marker([stop.pickup_lat, stop.pickup_lng], { icon: pickupIcon })
        .bindPopup(`
          <div class="p-2">
            <strong class="text-orange-600">📦 Recogida</strong>
            <p class="text-sm mt-1">${stop.pickup_address}</p>
            <p class="text-xs text-gray-500">${stop.client_name}</p>
          </div>
        `);
      
      if (onStopClick) {
        pickupMarker.on('click', () => onStopClick(stop));
      }
      
      markersRef.current?.addLayer(pickupMarker);

      // Delivery marker
      const deliveryMarker = L.marker([stop.delivery_lat, stop.delivery_lng], { icon: deliveryIcon })
        .bindPopup(`
          <div class="p-2">
            <strong class="text-green-600">🏠 Entrega</strong>
            <p class="text-sm mt-1">${stop.delivery_address}</p>
            <p class="text-xs text-gray-500">${stop.client_name}</p>
          </div>
        `);
      
      if (onStopClick) {
        deliveryMarker.on('click', () => onStopClick(stop));
      }
      
      markersRef.current?.addLayer(deliveryMarker);

      // Draw route line if selected or showRoute
      if (showRoute || stop.id === selectedStopId) {
        if (routeRef.current) {
          mapInstanceRef.current?.removeLayer(routeRef.current);
        }
        
        routeRef.current = L.polyline(
          [
            [stop.pickup_lat, stop.pickup_lng],
            [stop.delivery_lat, stop.delivery_lng],
          ],
          {
            color: '#f97316',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10',
          }
        ).addTo(mapInstanceRef.current!);
      }
    });

    // Add driver markers
    driverLocations.forEach((location) => {
      const driverMarker = L.marker([location.lat, location.lng], { icon: driverIcon })
        .bindPopup(`
          <div class="p-2">
            <strong>🚴 ${location.driver?.full_name || 'Repartidor'}</strong>
            <p class="text-xs text-gray-500">Última actualización: ${new Date(location.updated_at).toLocaleTimeString()}</p>
          </div>
        `);
      
      markersRef.current?.addLayer(driverMarker);
    });
  }, [stops, driverLocations, selectedStopId, showRoute, onStopClick]);

  // Center map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (centerOn) {
      mapInstanceRef.current.setView([centerOn.lat, centerOn.lng], 15);
    } else if (stops.length > 0) {
      const bounds = L.latLngBounds(
        stops.flatMap((stop) => [
          [stop.pickup_lat, stop.pickup_lng] as [number, number],
          [stop.delivery_lat, stop.delivery_lng] as [number, number],
        ])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [centerOn, stops]);

  return (
    <div 
      ref={mapRef} 
      className={`w-full h-full min-h-[300px] rounded-lg ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
