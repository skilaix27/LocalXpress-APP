

## Plan: Mostrar precio de zona en todas las vistas y precargar zonas globalmente

### Problema detectado
El precio + zona ya aparece en la mayoría de tarjetas y diálogos (admin, tienda, recogida del repartidor), pero faltan dos puntos clave en el repartidor y hay un problema de carga inicial de zonas.

### Cambios a implementar

**1. Mostrar zona y precio en la lista de paradas del repartidor** (`src/components/driver/DriverStopsList.tsx`)
- Añadir una línea con icono `Route` debajo de la dirección de recogida mostrando: `{km} km · {nombre zona} · {precio} €` cuando `stop.distance_km` esté disponible.
- Estilo coherente con el resto: texto pequeño, color primario para resaltar precio.

**2. Mostrar zona y precio en el diálogo de detalles del repartidor** (`src/components/driver/DriverStopDetailDialog.tsx`)
- Añadir un bloque destacado (similar al de "Recogida programada") justo después del teléfono mostrando icono `Route`, distancia ajustada, nombre de zona y precio en €.
- Usa los helpers `adjustDistance`, `getDeliveryZone`, `getDeliveryPrice` desde `@/lib/delivery-zones`.

**3. Precargar las zonas en cuanto arranca la app** (`src/App.tsx` o nuevo hook en el AuthProvider)
- Llamar a `fetchPricingZones()` al montar la app para que la caché esté lista antes de que el repartidor o la tienda abran cualquier parada.
- Sin esto, si el primer rol que carga es repartidor/tienda, los helpers caen al fallback hardcoded (sólo 4 zonas) y muestran "Zona 4+" sin precio para distancias > 15 km.
- También invalidar la caché cuando se actualiza una zona en `AdminSettings` (ya se hace via `invalidateZonesCache`) para que el siguiente render relea.

**4. Coherencia visual**
- En todos los puntos donde aparece la línea de zona se sigue el mismo formato:  
  `{Icono Route}  {km} km · {Zona N}: {Nombre} · {precio} €`
- Color primario (naranja) para distancia y precio; texto muted para el separador y nombre de zona.

### Resultado
- En el panel del repartidor, tanto en la lista global de paradas como en el diálogo de detalles completos, el repartidor ve claramente la zona y el precio del envío.
- Las zonas se cargan al inicio de la app, evitando el fallback que ocultaba los precios para distancias largas.
- Toda la app muestra el mismo formato `km · zona · precio €` de forma consistente para administrador, tienda y repartidor.

### Archivos afectados
- `src/components/driver/DriverStopsList.tsx` (mostrar zona + precio)
- `src/components/driver/DriverStopDetailDialog.tsx` (mostrar zona + precio)
- `src/App.tsx` (precarga de zonas al iniciar)

