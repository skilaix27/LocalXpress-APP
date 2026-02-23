import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MiniMapPreviewProps {
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  pickupResolved: boolean;
  deliveryResolved: boolean;
}

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33],
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33],
});

export function MiniMapPreview({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  pickupResolved,
  deliveryResolved,
}: MiniMapPreviewProps) {
  if (!pickupResolved && !deliveryResolved) return null;

  const center: [number, number] = pickupResolved && deliveryResolved
    ? [(pickupLat! + deliveryLat!) / 2, (pickupLng! + deliveryLng!) / 2]
    : pickupResolved
      ? [pickupLat!, pickupLng!]
      : [deliveryLat!, deliveryLng!];

  return (
    <div className="rounded-lg overflow-hidden border h-[160px] relative">
      <MapContainer
        center={center}
        zoom={pickupResolved && deliveryResolved ? 13 : 15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        key={`${pickupLat}-${pickupLng}-${deliveryLat}-${deliveryLng}`}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pickupResolved && pickupLat && pickupLng && (
          <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
            <Popup>Recogida</Popup>
          </Marker>
        )}
        {deliveryResolved && deliveryLat && deliveryLng && (
          <Marker position={[deliveryLat, deliveryLng]} icon={deliveryIcon}>
            <Popup>Entrega</Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="absolute bottom-1 left-1 z-[1000] flex gap-2 text-[10px]">
        {pickupResolved && (
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded">📍 Recogida</span>
        )}
        {deliveryResolved && (
          <span className="bg-green-600 text-white px-1.5 py-0.5 rounded">📍 Entrega</span>
        )}
      </div>
    </div>
  );
}
