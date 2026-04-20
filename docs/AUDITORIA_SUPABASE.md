# Auditoría Supabase — LocalXpress

> Fecha: 2026-04-20 | Solo lectura, sin modificaciones al código existente.

---

## Índice

1. [Configuración del cliente](#1-configuración-del-cliente)
2. [Esquema de base de datos](#2-esquema-de-base-de-datos)
3. [Autenticación](#3-autenticación)
4. [Pedidos / Stops](#4-pedidos--stops)
5. [Perfiles de usuario](#5-perfiles-de-usuario)
6. [Storage / Fotos](#6-storage--fotos)
7. [Realtime](#7-realtime)
8. [Edge Functions](#8-edge-functions)
9. [Integraciones externas](#9-integraciones-externas)
10. [Inventario de archivos con uso de Supabase](#10-inventario-de-archivos-con-uso-de-supabase)
11. [Observaciones para la migración](#11-observaciones-para-la-migración)

---

## 1. Configuración del cliente

**Archivo:** `src/integrations/supabase/client.ts`

- SDK: `@supabase/supabase-js` con `createClient<Database>()`
- Variables de entorno:
  - `VITE_SUPABASE_URL` — URL del proyecto (project_id: `nxvziacgnzuhtvodasjq`)
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key para autenticación cliente
- Configuración de auth:
  - Storage: `localStorage`
  - Sesiones persistentes: `true`
  - Auto-refresh de tokens: `true`

**Archivo de tipos:** `src/integrations/supabase/types.ts`
- Contiene los tipos generados de todas las tablas, enums y funciones RPC.

---

## 2. Esquema de base de datos

### Enums

| Nombre | Valores |
|--------|---------|
| `app_role` | `admin`, `driver`, `shop` |
| `stop_status` | `pending`, `assigned`, `picked`, `delivered` |
| `package_size` | `small`, `medium`, `large` |

### Tablas

#### `profiles`
Perfiles de usuario (1-a-1 con `auth.users`).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | TEXT | |
| `phone` | TEXT | |
| `avatar_url` | TEXT | |
| `is_active` | BOOLEAN | |
| `shop_name` | TEXT | Solo shops |
| `default_pickup_address` | TEXT | Solo shops |
| `default_pickup_lat` | DOUBLE | Solo shops |
| `default_pickup_lng` | DOUBLE | Solo shops |
| `privacy_accepted_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

- RLS: habilitado (8 políticas: usuario ve el propio, admin ve todos)
- Trigger: `handle_new_user()` — crea perfil automáticamente al registrarse

#### `user_roles`
Asignación de roles a usuarios.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | → `auth.users(id)` |
| `role` | app_role | |
| `created_at` | TIMESTAMPTZ | |

- Constraint: UNIQUE(user_id, role)
- RLS: habilitado (3 políticas: admin gestiona todo)
- Realtime: publicado en `supabase_realtime`

#### `stops`
Paradas / pedidos de entrega (entidad principal).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `pickup_address` | TEXT | |
| `pickup_lat` | DOUBLE | |
| `pickup_lng` | DOUBLE | |
| `delivery_address` | TEXT | |
| `delivery_lat` | DOUBLE | |
| `delivery_lng` | DOUBLE | |
| `client_name` | TEXT | |
| `client_phone` | TEXT | |
| `client_notes` | TEXT | |
| `driver_id` | UUID FK | → `profiles(id)` |
| `shop_id` | UUID FK | → `profiles(id)` |
| `created_by` | UUID FK | → `auth.users(id)` |
| `status` | stop_status | |
| `order_code` | TEXT UNIQUE | (nullable) |
| `package_size` | package_size | |
| `distance_km` | DOUBLE | |
| `price` | DOUBLE | |
| `price_driver` | DOUBLE | |
| `price_company` | DOUBLE | |
| `paid_by_client` | BOOLEAN | |
| `paid_by_client_at` | TIMESTAMPTZ | |
| `paid_to_driver` | BOOLEAN | |
| `paid_to_driver_at` | TIMESTAMPTZ | |
| `proof_photo_url` | TEXT | |
| `shop_name` | TEXT | |
| `scheduled_pickup_at` | TIMESTAMPTZ | |
| `picked_at` | TIMESTAMPTZ | |
| `delivered_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

- RLS: habilitado (5 políticas)
  - Admin: acceso total
  - Driver: solo sus stops asignados
  - Shop: solo sus propios stops; puede borrar los no entregados
- Realtime: habilitado
- Index: `stops_order_code_unique`

#### `driver_locations`
Posición GPS en tiempo real de los repartidores.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `driver_id` | UUID FK UNIQUE | → `profiles(id)` |
| `lat` | DOUBLE | |
| `lng` | DOUBLE | |
| `heading` | DOUBLE | nullable |
| `speed` | DOUBLE | nullable |
| `updated_at` | TIMESTAMPTZ | |

- RLS: habilitado (2 políticas: admins ven todo, drivers gestionan el propio)
- Realtime: habilitado
- Index: `idx_driver_locations_updated_at`
- Cleanup: función `cleanup_old_driver_locations()` — borra registros >30 días

#### `pricing_zones`
Configuración de tarifas por distancia.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `min_km` | DOUBLE | |
| `max_km` | DOUBLE | nullable (última zona) |
| `fixed_price` | DOUBLE | nullable |
| `per_km_price` | DOUBLE | nullable |
| `sort_order` | INT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### Funciones de seguridad (security definer)

| Función | Propósito |
|---------|-----------|
| `has_role(_user_id, _role)` | Verifica si un usuario tiene un rol concreto (evita recursión RLS) |
| `get_profile_id(_user_id)` | Devuelve el `id` del perfil de un usuario |

### Cronología de migraciones

| Fecha | Cambio |
|-------|--------|
| 2026-02-05 | Schema inicial: profiles, user_roles, stops, driver_locations, RLS, triggers, realtime |
| 2026-02-21 | Storage: bucket `delivery-proofs` + políticas |
| 2026-02-24 | Enum `shop` en app_role |
| 2026-02-24 | FK `shop_id` en stops + políticas RLS para shops |
| 2026-02-24 | Campos shop en profiles: shop_name, default_pickup_* |
| 2026-02-24 | Campos en stops: distance_km, scheduled_pickup_at, order_code |
| 2026-02-26 | Bucket delivery-proofs → privado + políticas de auth |
| 2026-02-26 | Enum `package_size` + columna en stops |
| 2026-02-27 | Campos de pago: paid_by_client, paid_to_driver, iban, nif, fiscal_address, admin_notes |
| 2026-02-28 | profiles y user_roles añadidos a publicación realtime |
| 2026-03-03 | Política DELETE para shops sobre stops no entregados |

---

## 3. Autenticación

**Hook principal:** `src/hooks/useAuth.tsx`

| Operación | Método Supabase |
|-----------|----------------|
| Login | `supabase.auth.signInWithPassword({ email, password })` |
| Logout | `supabase.auth.signOut()` |
| Sesión actual | `supabase.auth.getSession()` |
| Escuchar cambios | `supabase.auth.onAuthStateChange()` |

**Contexto expuesto:** `user`, `session`, `profile`, `role`, `loading`, `isAdmin`, `isDriver`, `isShop`, `privacyAccepted`

**Flujo al autenticar:**
1. `onAuthStateChange` detecta sesión
2. Consulta `profiles` para obtener el perfil
3. Consulta `user_roles` para obtener el rol
4. Expone el contexto en toda la aplicación

---

## 4. Pedidos / Stops

### Lectura de stops

| Módulo | Query |
|--------|-------|
| Admin (`useAdminData`) | `SELECT * FROM stops ORDER BY created_at DESC` |
| Driver (`DriverApp`) | `SELECT * FROM stops WHERE driver_id = ?` |
| Shop (`useShopData`) | `SELECT * FROM stops WHERE shop_id = ?` |

### Operaciones de escritura

| Operación | Quién | Método |
|-----------|-------|--------|
| Crear stop | Admin (`CreateStopDialog`) | `supabase.from('stops').insert(...)` |
| Crear stop | Shop (`CreateShopStopDialog`) | `supabase.from('stops').insert(...)` |
| Crear stop | API externa | Edge function `create-order` |
| Actualizar stop | Admin (`StopDetailDialog`) | `supabase.from('stops').update(...)` |
| Actualizar stop | Driver (entrega) | `supabase.from('stops').update({ status, delivered_at, proof_photo_url })` |
| Borrar stop | Admin | `supabase.from('stops').delete().eq('id', id)` |
| Borrar stop | Shop (no entregado) | `supabase.from('stops').delete().eq('id', id)` |

---

## 5. Perfiles de usuario

**Hook:** `useAuth` (lectura), edge functions (escritura)

| Operación | Método |
|-----------|--------|
| Leer perfil propio | `SELECT * FROM profiles WHERE user_id = ?` |
| Crear usuario + perfil | Edge function `create-user` |
| Actualizar perfil + password | Edge function `update-user` |
| Buscar email por nombre | Edge function `lookup-email` |

**Gestión de usuarios admin:** `src/components/admin/CreateUserDialog.tsx`, `DriverDetailDialog.tsx`

---

## 6. Storage / Fotos

**Bucket:** `delivery-proofs` (privado)

**Políticas:**

| Acción | Quién |
|--------|-------|
| Upload (INSERT) | Usuarios autenticados |
| Ver (SELECT) | Usuarios autenticados |
| Borrar (DELETE) | Solo admins |

**Flujo de subida (driver):**
1. `DeliveryProofDialog.tsx` captura la foto
2. Comprime a JPEG máx 1200px, calidad 60%, < 10MB
3. `supabase.storage.from('delivery-proofs').upload(path, file)`
4. Path: `{driver_id}/{stop_id}-{timestamp}.jpg`
5. Guarda la URL en `stops.proof_photo_url`

**Visualización:**
- Hook `useSignedUrl.ts` genera URLs firmadas con 1h de expiración
- `supabase.storage.from('delivery-proofs').createSignedUrl(path, 3600)`

**Borrado:**
- Al eliminar un stop, el admin borra también el archivo del storage

---

## 7. Realtime

### Tablas con realtime habilitado

| Tabla | Publicación |
|-------|------------|
| `stops` | `supabase_realtime` |
| `driver_locations` | `supabase_realtime` |
| `profiles` | `supabase_realtime` |
| `user_roles` | `supabase_realtime` |

### Suscripciones activas

| Canal | Módulo | Eventos |
|-------|--------|---------|
| `stops-changes` | Admin (`useAdminData`) | INSERT/UPDATE/DELETE en stops |
| `locations-changes` | Admin | INSERT/UPDATE/DELETE en driver_locations |
| `profiles-changes` | Admin | INSERT/UPDATE/DELETE en profiles |
| `roles-changes` | Admin | INSERT/UPDATE/DELETE en user_roles |
| `shop-stops-changes` | Shop (`useShopData`) | Cambios en stops propios |
| (driver stops) | Driver (`DriverApp`) | Cambios en stops asignados |

**Nota importante:** El módulo admin tiene un fallback de polling cada 10s y el de shop cada 8s, por posibles problemas de evaluación RLS en subscripciones realtime.

**Debouncing:** 400–2000ms en callbacks para evitar refetches excesivos.

---

## 8. Edge Functions

Todas en `supabase/functions/`. La mayoría tienen `verify_jwt = false` (validación manual interna).

### `create-user`
- **Propósito:** Crear usuario con perfil y rol asignado
- **Auth:** Verifica rol admin del llamador
- **Operaciones DB:**
  - `supabase.auth.admin.createUser({ email, password })`
  - `UPDATE profiles SET full_name, phone, is_active WHERE user_id = ?`
  - `INSERT INTO user_roles (user_id, role)`
- **Llamado desde:** `CreateUserDialog.tsx`

### `update-user`
- **Propósito:** Actualizar campos de perfil y/o contraseña
- **Auth:** Verifica rol admin del llamador
- **Operaciones DB:**
  - `supabase.auth.admin.updateUserById(userId, { password })`
  - `UPDATE profiles SET full_name, phone, is_active WHERE user_id = ?`
- **Llamado desde:** `DriverDetailDialog.tsx`

### `lookup-email`
- **Propósito:** Recuperar email de un usuario por su nombre completo
- **Auth:** Ninguna (pública)
- **Operaciones DB:** `SELECT user_id FROM profiles WHERE full_name = ?`
- **Nota:** Sin protección — cualquiera puede hacer lookup de emails por nombre

### `create-order`
- **Propósito:** Crear un stop desde API externa (integración B2B)
- **Auth:** API key en header (`x-api-key`)
- **Operaciones DB:** `INSERT INTO stops` con generación de `order_code` único
- **Nota:** Permite creación de pedidos sin autenticación de usuario

### `calculate-route`
- **Propósito:** Calcular distancia y duración entre dos puntos
- **Auth:** JWT de Supabase
- **Operaciones DB:** Ninguna
- **Integración externa:** Google Routes API v2
- **Env:** `GOOGLE_MAPS_API_KEY`

### `notify-new-stop`
- **Propósito:** Enviar email de notificación cuando se crea un stop de shop
- **Auth:** Verifica rol shop o admin del llamador
- **Operaciones DB:** Ninguna
- **Integración externa:** Resend API
- **Env:** `RESEND_API_KEY`
- **Destinatario hardcodeado:** `robertogarcia2772@gmail.com` ⚠️

### `places-autocomplete`
- **Propósito:** Autocompletar direcciones con Google Places
- **Auth:** JWT de Supabase
- **Operaciones DB:** Ninguna
- **Integración externa:** Google Places API v1

---

## 9. Integraciones externas

| Servicio | Función | Variable de entorno |
|----------|---------|-------------------|
| Google Routes API v2 | Calcular distancia y duración de ruta | `GOOGLE_MAPS_API_KEY` |
| Google Places API v1 | Autocompletar direcciones | `GOOGLE_MAPS_API_KEY` |
| Resend (email) | Notificaciones de nuevos stops | `RESEND_API_KEY` |

---

## 10. Inventario de archivos con uso de Supabase

### Infraestructura

| Archivo | Uso |
|---------|-----|
| `src/integrations/supabase/client.ts` | Singleton del cliente Supabase |
| `src/integrations/supabase/types.ts` | Tipos generados de DB |

### Hooks

| Archivo | Categoría | Operaciones |
|---------|-----------|-------------|
| `src/hooks/useAuth.tsx` | Auth | signIn, signOut, getSession, onAuthStateChange; SELECT profiles, user_roles |
| `src/hooks/useAdminData.ts` | Pedidos/Admin | SELECT stops, profiles, driver_locations, user_roles; realtime x4 |
| `src/hooks/useShopData.ts` | Pedidos/Shop | SELECT stops WHERE shop_id; realtime; DELETE stops |
| `src/hooks/usePricingZones.ts` | Config | SELECT/INSERT/UPDATE/DELETE pricing_zones |
| `src/hooks/useSignedUrl.ts` | Storage | createSignedUrl en delivery-proofs |

### Componentes admin

| Archivo | Operaciones |
|---------|-------------|
| `src/components/admin/CreateStopDialog.tsx` | INSERT stops |
| `src/components/admin/StopDetailDialog.tsx` | UPDATE/DELETE stops; DELETE storage |
| `src/components/admin/CreateUserDialog.tsx` | Invoca edge function `create-user` |
| `src/components/admin/DriverDetailDialog.tsx` | Invoca edge function `update-user` |

### Componentes driver

| Archivo | Operaciones |
|---------|-------------|
| `src/components/driver/DeliveryProofDialog.tsx` | storage.upload; UPDATE stops (status, proof_photo_url) |
| `src/components/driver/DriverStopsList.tsx` | SELECT stops WHERE driver_id (lectura) |

### Componentes shop

| Archivo | Operaciones |
|---------|-------------|
| `src/components/shop/CreateShopStopDialog.tsx` | INSERT stops; invoca `notify-new-stop` |
| `src/components/shop/ShopStopDetailDialog.tsx` | UPDATE/DELETE stops |

### Páginas

| Archivo | Hooks usados |
|---------|-------------|
| `src/pages/AdminDashboard.tsx` | useAdminData |
| `src/pages/AdminSettings.tsx` | usePricingZones |
| `src/pages/ShopNewStop.tsx` | useShopData |
| `src/pages/ShopHistory.tsx` | useShopData |
| `src/pages/DriverApp.tsx` | useAuth (stops del driver) |

---

## 11. Observaciones para la migración

### Qué hay que reemplazar

| Componente Supabase | Equivalente en arquitectura propia |
|--------------------|-----------------------------------|
| `supabase.auth.*` | JWT propio (Node.js + bcrypt + jsonwebtoken) |
| `supabase.from('table').select()` | Endpoints REST en Express |
| `supabase.from('table').insert()` | Endpoints POST en Express |
| `supabase.from('table').update()` | Endpoints PATCH/PUT en Express |
| `supabase.from('table').delete()` | Endpoints DELETE en Express |
| RLS policies | Middleware de autorización en Express |
| Edge functions | Routes en Express |
| `supabase.storage.*` | MinIO o S3 compatible |
| Realtime channels | Socket.io |
| `supabase.auth.admin.*` | Admin endpoints propios con rol verificado |

### Riesgos y notas

1. **`lookup-email` sin autenticación** — la función es pública y devuelve emails por nombre. En el backend propio, protegerla con auth admin.

2. **Email hardcodeado en `notify-new-stop`** — `robertogarcia2772@gmail.com` está literal en el código. Al migrar, parametrizar el destinatario.

3. **Polling fallback en realtime** — admin y shop tienen fallback cada 8–10s. Con Socket.io esto debería simplificarse pero hay que asegurar la fiabilidad de los eventos.

4. **URLs firmadas de storage** — expiran en 1h. Con MinIO habrá que implementar firma similar o hacer bucket semipúblico con auth por token.

5. **`create-order` con API key** — al migrar hay que mantener un endpoint autenticado por API key para integración B2B.

6. **Trigger `handle_new_user`** — en la migración, el backend propio deberá crear el perfil automáticamente al registrar un usuario (no hay trigger en PostgreSQL standalone a menos que se implemente).

7. **Función `has_role`** — al eliminar Supabase RLS, toda la lógica de autorización por rol pasa al middleware Express. El modelo de roles (admin/driver/shop) se mantiene igual.

8. **`pricing_zones`** — no hay archivo de migración visible para esta tabla. Verificar si existe en la DB real o si fue creada manualmente fuera del historial de migraciones.
