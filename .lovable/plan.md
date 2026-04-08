

## Plan: API de Pedidos para integración con n8n

### Contexto
Crear un Edge Function que actúe como endpoint REST (`POST /create-order`) para que n8n pueda crear paradas/pedidos automáticamente a partir de emails procesados. Ya existe un secret `API_SECRET_KEY` que se usará para autenticar las llamadas desde n8n.

### Flujo
```text
Email → n8n (extrae datos) → POST create-order (API key) → inserta en tabla stops → app actualiza en tiempo real
```

### Implementación

**1. Crear Edge Function `create-order`** (`supabase/functions/create-order/index.ts`)

- Autenticación via header `x-api-key` validado contra el secret `API_SECRET_KEY` (sin JWT, pensado para llamadas server-to-server desde n8n)
- Validación con Zod de todos los campos del body
- Generación automática de `order_code` con la misma lógica existente (reimplementada server-side)
- Inserción en la tabla `stops` usando el service role key
- Respuesta JSON con el pedido creado (id, order_code, status)

**Body esperado (POST)**:
```json
{
  "client_name": "Juan García",
  "client_phone": "+34612345678",
  "client_notes": "Piso 3, puerta B",
  "pickup_address": "Calle Mayor 10, Barcelona",
  "pickup_lat": 41.385,
  "pickup_lng": 2.173,
  "delivery_address": "Av. Diagonal 200, Barcelona",
  "delivery_lat": 41.392,
  "delivery_lng": 2.165,
  "shop_name": "Mi Tienda",
  "package_size": "medium",
  "scheduled_pickup_at": "2026-04-06T10:00:00Z"
}
```

Campos opcionales: `client_phone`, `client_notes`, `shop_name`, `package_size`, `scheduled_pickup_at`, `shop_id`, `driver_id`.

**2. Configurar `config.toml`**
- Añadir bloque `[functions.create-order]` con `verify_jwt = false`

**3. Seguridad**
- Validación de API key en el código (comparación constante contra `API_SECRET_KEY`)
- Validación de coordenadas (rango lat/lng válido)
- Límites de longitud en strings
- Sin acceso público: solo con la API key correcta

### Uso desde n8n
n8n haría un HTTP Request node con:
- URL: `https://nxvziacgnzuhtvodasjq.supabase.co/functions/v1/create-order`
- Method: POST
- Header: `x-api-key: <tu_api_key>`
- Body: JSON con los datos del pedido

Los pedidos aparecerán automáticamente en la app gracias al polling ya implementado.

