# LocalXpress Backend

API REST en Node.js + Express + TypeScript para reemplazar Supabase.

## Stack

- **Runtime**: Node.js 20
- **Framework**: Express 4
- **Lenguaje**: TypeScript 5
- **Base de datos**: PostgreSQL 16 (via `pg`)
- **Auth**: JWT (`jsonwebtoken`) + bcrypt
- **Validación**: Zod
- **Ficheros**: Multer (local filesystem → MinIO futuro)

## Arrancar en local (con Docker)

```bash
# En la raíz del proyecto
docker compose up -d postgres   # solo la DB

# En /backend
cp .env.example .env
# Editar .env si hace falta (DATABASE_URL ya apunta a localhost:5432)

npm install
npm run dev
# → http://localhost:3001
```

## Arrancar en local (sin Docker)

Necesitas PostgreSQL corriendo localmente y crear la base de datos:

```bash
createdb localxpress
psql localxpress -f ../database/migrations/001_initial_schema.sql

cp .env.example .env
# Ajustar DATABASE_URL

npm install
npm run dev
```

## Compilar para producción

```bash
npm run build    # genera dist/
npm start        # node dist/index.js
```

## Variables de entorno

Ver [.env.example](.env.example) para la lista completa.

Las mínimas para funcionar:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión PostgreSQL |
| `JWT_SECRET` | Secreto mínimo 32 chars (usar `openssl rand -base64 48`) |

## Endpoints disponibles

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/api/health` | Estado del servidor y DB | — |
| `POST` | `/api/auth/login` | Login, devuelve JWT | — |
| `GET` | `/api/auth/me` | Usuario actual | JWT |
| `POST` | `/api/auth/refresh` | Renovar token | JWT |
| `GET` | `/api/users` | Listar usuarios | Admin |
| `POST` | `/api/users` | Crear usuario+perfil+rol | Admin |
| `GET` | `/api/users/lookup-email` | Buscar email por nombre | Admin |
| `GET` | `/api/users/:id` | Detalle usuario | Admin |
| `PATCH` | `/api/users/:id` | Actualizar usuario | Admin |
| `DELETE` | `/api/users/:id` | Eliminar usuario | Admin |
| `GET` | `/api/profiles/me` | Mi perfil | JWT |
| `PATCH` | `/api/profiles/me` | Actualizar mi perfil | JWT |
| `GET` | `/api/profiles` | Listar perfiles | Admin |
| `GET` | `/api/profiles/:id` | Perfil por id | Admin |
| `PATCH` | `/api/profiles/:id` | Actualizar perfil | Admin |
| `GET` | `/api/stops` | Listar stops (filtrado por rol) | JWT |
| `POST` | `/api/stops` | Crear stop | Admin/Shop |
| `POST` | `/api/stops/order` | Crear stop B2B | API Key |
| `GET` | `/api/stops/:id` | Detalle stop | JWT |
| `PATCH` | `/api/stops/:id` | Actualizar stop | JWT |
| `DELETE` | `/api/stops/:id` | Eliminar stop | Admin/Shop |
| `GET` | `/api/driver-locations` | Ubicaciones drivers | JWT |
| `PUT` | `/api/driver-locations` | Actualizar ubicación propia | Driver |
| `GET` | `/api/driver-locations/:id` | Ubicación de un driver | Admin |
| `DELETE` | `/api/driver-locations/cleanup` | Limpiar ubicaciones antiguas | Admin |
| `GET` | `/api/pricing-zones` | Listar zonas de precio | JWT |
| `POST` | `/api/pricing-zones` | Crear zona | Admin |
| `PATCH` | `/api/pricing-zones/:id` | Actualizar zona | Admin |
| `DELETE` | `/api/pricing-zones/:id` | Eliminar zona | Admin |
| `POST` | `/api/uploads/proof/:stop_id` | Subir foto de entrega | Driver/Admin |
| `GET` | `/api/uploads/proof/:stop_id` | Listar fotos de un stop | JWT |
| `DELETE` | `/api/uploads/proof/:stop_id` | Borrar fotos de un stop | Admin |

## Roles y permisos

| Rol | Permisos clave |
|-----|---------------|
| `admin` | Acceso total |
| `driver` | Ve sus stops asignados; actualiza estado y ubicación |
| `shop` | Ve y crea sus propios stops; no puede ver datos de otros shops |

## Estructura

```
src/
├── config.ts          # env vars con validación Zod
├── db.ts              # pool PostgreSQL + helpers
├── index.ts           # servidor Express
├── types.ts           # tipos TypeScript compartidos
├── middleware/
│   ├── auth.ts        # requireAuth, requireApiKey
│   ├── roles.ts       # requireRole, requireAdmin
│   └── errorHandler.ts
├── routes/
│   ├── health.ts
│   ├── auth.ts
│   ├── users.ts
│   ├── profiles.ts
│   ├── stops.ts
│   ├── driver-locations.ts
│   ├── pricing-zones.ts
│   └── uploads.ts
└── utils/
    ├── hash.ts        # bcrypt
    ├── jwt.ts         # sign/verify
    ├── response.ts    # helpers de respuesta HTTP
    └── schemas.ts     # esquemas Zod de validación
```

## Crear el primer usuario admin

No hay endpoint de registro público. Usar directamente la DB o el script siguiente:

```bash
# Desde psql — sustituir por tus valores
INSERT INTO users (email, password_hash, is_active)
VALUES (
  'admin@localxpress.com',
  -- generar con: node -e "const b=require('bcryptjs'); b.hash('tu_password',12).then(console.log)"
  '$2a$12$...',
  true
);
-- El trigger crea el perfil automáticamente
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'admin@localxpress.com';
```

O usar el script de seed incluido (ver `scripts/seed-admin.ts` — pendiente de añadir).
