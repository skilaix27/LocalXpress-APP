# deliver-bcn-flow — Contexto completo del proyecto

## Qué es
App de reparto local (LocalXpress) para Barcelona.
Tres roles: admin, driver, shop.

## Stack actual (Lovable)
- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind
- Auth: Supabase Auth
- DB: Supabase PostgreSQL con RLS
- Realtime: Supabase Realtime (postgres_changes)
- Storage: Supabase Storage (bucket delivery-proofs)
- Edge Functions: calculate-route, create-order, create-user,
  lookup-email, notify-new-stop, places-autocomplete, update-user

## Stack objetivo (nuestro VPS)
- Frontend: mismo React/Vite, solo cambiar capa de datos
- Backend: Node.js + Express + TypeScript en puerto 3001
- DB: PostgreSQL en VPS
- Realtime: WebSockets propios (reemplaza Supabase Realtime)
- Storage: multer + disco VPS en /var/www/localxpress/uploads
- Auth: JWT propio (reemplaza Supabase Auth)
- Edge Functions → endpoints Express propios

## REGLA PRINCIPAL
El frontend NO se toca visualmente. Solo se reemplaza la capa de datos:
- supabase.from('tabla').select() → fetch('/api/v1/...')
- supabase.auth.signInWithPassword() → POST /api/v1/auth/login
- supabase Realtime → WebSocket propio
- supabase Storage → POST /api/v1/uploads/...

## Entidades y tipos

### Roles
type AppRole = 'admin' | 'driver' | 'shop'

### StopStatus
type StopStatus = 'pending' | 'assigned' | 'picked' | 'delivered'

### PackageSize
type PackageSize = 'small' | 'medium' | 'large'

### User (tabla users — auth propia)
id, email, password_hash, role: AppRole, is_active, created_at, updated_at

### Profile (tabla profiles — 1:1 con users)
id, user_id, full_name, phone, avatar_url, shop_name,
default_pickup_address, default_pickup_lat, default_pickup_lng,
privacy_accepted_at, is_active, created_at, updated_at

### Stop (entidad central)
id, pickup_address, pickup_lat, pickup_lng,
delivery_address, delivery_lat, delivery_lng,
client_name, client_phone, client_notes,
driver_id (→ profiles.id), shop_id (→ profiles.id),
created_by (→ users.id), status: StopStatus,
order_code (único), package_size: PackageSize,
distance_km, shop_name, proof_photo_url,
scheduled_pickup_at, picked_at, delivered_at,
created_at, updated_at

### DriverLocation
id, driver_id (→ profiles.id, UNIQUE), lat, lng,
heading, speed, updated_at

### PricingZone
id, name, min_km, max_km, fixed_price, per_km_price,
sort_order, created_at, updated_at

## Lógica de negocio crítica

### Zonas de precio (delivery-zones.ts)
- MARGIN_KM = 0.15 (si falta ≤150m para la zona siguiente, sube de zona)
- adjusted = distanceKm + 0.15
- Se busca zona donde adjusted > min_km AND adjusted <= max_km
- fixed_price: precio fijo; per_km_price: precio por km extra sobre min_km
- Cache de 60s en frontend (el backend puede añadir cache también)

### Estados de stop
pending → assigned (admin asigna driver) → picked (driver recoge)
→ delivered (driver entrega + sube foto)

### Stops expirados
Si scheduled_pickup_at existe y la fecha pasó (fin del día) y status != picked/delivered
→ se considera expirado (no se muestra en activos)

### Notificaciones en tiempo real
- Admin recibe toast cuando llega un stop nuevo (status: pending)
- Shop recibe toast cuando su stop pasa a 'assigned'
- Sonido de notificación en admin al llegar nuevo stop

### order_code
Código único alfanumérico por stop. Ver lib/order-code.ts para formato.

## Realtime — cómo funciona actualmente y cómo reemplazar

### Actual (Supabase)
useAdminData.ts suscribe a:
- 'stops-changes': tabla stops, todos los eventos
- 'locations-changes': tabla driver_locations
- 'profiles-changes': tabla profiles
- 'roles-changes': tabla user_roles
+ polling fallback cada 10s

useShopData.ts suscribe a:
- 'shop-stops-changes': tabla stops
+ polling fallback cada 8s

### Nuestro WebSocket (a construir)
El backend emite eventos cuando:
- Se crea/actualiza un stop → ws.broadcast('stop:update', stop)
- Driver actualiza ubicación → ws.broadcast('location:update', location)
- Se crea/actualiza un usuario → ws.broadcast('user:update', user)

El frontend se conecta al WS y llama a los mismos callbacks que antes.

## Archivos del frontend que usan Supabase (37 archivos — migrar en orden)

### PRIORIDAD 1 — Capa de integración (reemplazar primero)
- frontend/src/integrations/supabase/client.ts → reemplazar por api-client.ts
- frontend/src/integrations/supabase/types.ts → reemplazar por types propios

### PRIORIDAD 2 — Hooks (lógica de datos)
- hooks/useAuth.tsx → JWT login/logout/profile/roles
- hooks/useAdminData.ts → stops+drivers+locations con WS
- hooks/useShopData.ts → stops de la shop con WS
- hooks/useSignedUrl.ts → URLs de fotos desde nuestro storage
- hooks/usePricingZones.ts → GET /api/v1/pricing-zones
- hooks/useRouteDistance.ts → GET /api/v1/routes/distance

### PRIORIDAD 3 — Páginas
- pages/Auth.tsx
- pages/admin/AdminDashboard.tsx
- pages/admin/AdminDrivers.tsx
- pages/admin/AdminMap.tsx
- pages/admin/AdminStops.tsx
- pages/admin/AdminHistory.tsx
- pages/driver/DriverApp.tsx
- pages/shop/ShopDashboard.tsx
- pages/shop/ShopHistory.tsx
- pages/shop/ShopNewStop.tsx

### PRIORIDAD 4 — Componentes
(ver lista completa en docs/migration-files.md)

## Endpoints del backend a construir

### Auth
POST   /api/v1/auth/login           → { email, password } → { token, user, profile, role }
POST   /api/v1/auth/logout          → invalida token
GET    /api/v1/auth/me              → { user, profile, role }
PUT    /api/v1/auth/password        → { currentPassword, newPassword }
POST   /api/v1/auth/accept-privacy  → marca privacy_accepted_at

### Users (solo admin)
GET    /api/v1/users                → todos los usuarios con perfil y rol
POST   /api/v1/users                → crear usuario (admin crea driver/shop)
PUT    /api/v1/users/:id            → actualizar usuario
DELETE /api/v1/users/:id            → desactivar usuario
GET    /api/v1/users/lookup?email=  → buscar por email

### Stops
GET    /api/v1/stops                → todos (admin) / los propios (shop/driver)
POST   /api/v1/stops                → crear stop (admin o shop)
GET    /api/v1/stops/:id            → detalle
PUT    /api/v1/stops/:id            → actualizar (status, driver_id, etc.)
DELETE /api/v1/stops/:id            → eliminar (admin o shop si no entregado)
PUT    /api/v1/stops/:id/assign     → asignar driver (admin)
PUT    /api/v1/stops/:id/pick       → marcar como picked (driver)
PUT    /api/v1/stops/:id/deliver    → marcar como delivered + foto (driver)

### Driver locations
GET    /api/v1/locations            → todas (admin)
PUT    /api/v1/locations            → driver actualiza su ubicación
DELETE /api/v1/locations/:driverId  → limpiar ubicación

### Pricing zones
GET    /api/v1/pricing-zones        → todas las zonas (público)
POST   /api/v1/pricing-zones        → crear zona (admin)
PUT    /api/v1/pricing-zones/:id    → actualizar zona (admin)
DELETE /api/v1/pricing-zones/:id    → eliminar zona (admin)

### Uploads
POST   /api/v1/uploads/proof        → subir foto de entrega (driver)
GET    /api/v1/uploads/:filename    → servir foto (autenticado)

### Google Places (proxy)
GET    /api/v1/places/autocomplete?input= → proxy a Google Places API
GET    /api/v1/routes/distance?origin=&destination= → cálculo distancia

### WebSocket
WS     /ws                          → conexión WebSocket autenticada con JWT

## Middlewares necesarios
- authMiddleware: verifica JWT, adjunta user/profile/role al request
- requireRole(...roles): verifica que el usuario tiene el rol requerido
- errorHandler: manejo centralizado de errores
- upload: multer configurado para /var/www/localxpress/uploads

## Variables de entorno (backend/.env)
DATABASE_URL=postgresql://localxpress:PASSWORD@localhost:5432/localxpress
JWT_SECRET=secreto_muy_largo_minimo_32_chars
JWT_EXPIRES_IN=7d
PORT=3001
GOOGLE_MAPS_API_KEY=tu_clave_aqui
UPLOAD_DIR=/var/www/localxpress/uploads
BASE_URL=https://tu-dominio.com
N8N_WEBHOOK_URL=http://localhost:5678/webhook/localxpress
FRONTEND_URL=https://tu-dominio.com

## Estructura de carpetas del backend a crear
backend/
├── src/
│   ├── index.ts              ← servidor Express + WS
│   ├── db.ts                 ← pool PostgreSQL
│   ├── types.ts              ← tipos TypeScript compartidos
│   ├── middleware/
│   │   ├── auth.ts           ← verificar JWT
│   │   ├── roles.ts          ← requireRole()
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── stops.ts
│   │   ├── locations.ts
│   │   ├── pricingZones.ts
│   │   ├── uploads.ts
│   │   └── places.ts
│   ├── controllers/          ← lógica de cada endpoint
│   ├── services/
│   │   ├── websocket.ts      ← gestión WS y broadcast
│   │   └── orderCode.ts      ← generar order_code único
│   └── lib/
│       └── deliveryZones.ts  ← misma lógica que frontend/src/lib/delivery-zones.ts
├── package.json
├── tsconfig.json
└── .env.example

## Orden de construcción — FASES

### FASE 1 (empezar aquí)
1. backend/package.json + tsconfig.json
2. backend/src/db.ts
3. backend/src/index.ts (Express básico + health check)
4. backend/src/middleware/auth.ts + roles.ts
5. backend/src/routes/auth.ts (login + me)
6. Probar: POST /api/v1/auth/login devuelve JWT

### FASE 2
7. backend/src/routes/users.ts (CRUD completo)
8. backend/src/routes/stops.ts (CRUD + cambios de estado)
9. backend/src/services/orderCode.ts
10. backend/src/services/websocket.ts

### FASE 3
11. backend/src/routes/locations.ts
12. backend/src/routes/pricingZones.ts
13. backend/src/routes/uploads.ts (multer)
14. backend/src/routes/places.ts (proxy Google)

### FASE 4 — Migración frontend
15. frontend/src/lib/api-client.ts (reemplaza cliente Supabase)
16. frontend/src/hooks/useAuth.tsx (migrar a JWT)
17. frontend/src/hooks/useAdminData.ts (migrar a WS propio)
18. frontend/src/hooks/useShopData.ts
19. resto de hooks, páginas y componentes

### FASE 5 — Infra
20. infra/nginx.conf
21. infra/pm2.config.js
22. infra/docker-compose.yml (opcional)
23. Script de deploy

### FASE 6 — n8n
24. Webhook en backend → n8n al crear stop
25. Flujo WhatsApp notificación nuevo stop
26. Flujo email confirmación entrega