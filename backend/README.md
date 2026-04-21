# LocalXpress Backend

API REST — Node.js 20 + Express + TypeScript + PostgreSQL 16.

---

## Índice

- [Stack](#stack)
- [Desarrollo local](#desarrollo-local)
- [Despliegue en VPS 109.176.197.56](#despliegue-en-vps-109176197556)
- [Credenciales de prueba](#credenciales-de-prueba)
- [Variables de entorno](#variables-de-entorno)
- [Endpoints](#endpoints)
- [Crear primer admin](#crear-primer-admin)
- [Estructura](#estructura)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Express 4 |
| Lenguaje | TypeScript 5 (strict) |
| ORM/DB | `pg` (PostgreSQL 16) |
| Auth | JWT (`jsonwebtoken`) + bcrypt (12 rounds) |
| Validación | Zod |
| Uploads | Multer → filesystem local |

---

## Desarrollo local

### Opción A — Solo DB en Docker, backend en local

```bash
# 1. Levantar solo PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 2. Configurar backend
cd backend
cp .env.example .env
# Editar DATABASE_URL si usas credenciales distintas
# Por defecto apunta a localhost:5432

# 3. Instalar y arrancar en modo watch
npm install
npm run dev
# → http://localhost:3001
```

### Opción B — Todo en Docker (prod local)

```bash
docker compose up -d --build
# Backend en http://localhost:3001
```

### Verificar

```bash
curl http://localhost:3001/api/health
```

---

## Despliegue en VPS 109.176.197.56

### Requisitos en el VPS

```bash
# Ubuntu 22.04 / Debian 12
# Instalar Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# (cerrar sesión y volver a entrar)

# Instalar Nginx
sudo apt install -y nginx
```

### Paso 1 — Clonar el repositorio

```bash
sudo mkdir -p /var/www/localxpress
sudo chown $USER:$USER /var/www/localxpress
git clone https://github.com/TU_USUARIO/LocalXpress-APP.git /var/www/localxpress
cd /var/www/localxpress
```

### Paso 2 — Configurar el .env del backend

```bash
# El archivo .env ya viene con credenciales de prueba funcionales.
# Puedes usarlo tal cual para la primera puesta en marcha.
# Para producción real, cambia las credenciales.
ls backend/.env   # debe existir
```

Si necesitas regenerarlo:
```bash
cp backend/.env.example backend/.env
# Editar con tus valores reales
nano backend/.env
```

### Paso 3 — Levantar los servicios con Docker Compose

```bash
cd /var/www/localxpress
docker compose up -d --build
```

Esto:
- Construye la imagen del backend (2-3 min la primera vez)
- Levanta PostgreSQL 16 con los datos persistentes en un volumen
- Ejecuta automáticamente la migración SQL inicial
- Arranca el backend en el puerto 3001 (solo accesible desde localhost)

### Paso 4 — Verificar que los contenedores están corriendo

```bash
docker compose ps
docker compose logs -f backend    # logs en tiempo real
```

### Paso 5 — Crear el usuario admin

```bash
docker compose exec backend npx tsx scripts/seed-admin.ts
# Crea: admin@localxpress.com / Admin_LX_2024!
# O personalizado:
docker compose exec backend npx tsx scripts/seed-admin.ts tu@email.com TuPassword123!
```

### Paso 6 — Configurar Nginx

```bash
sudo cp /var/www/localxpress/infra/nginx/localxpress.conf.example \
        /etc/nginx/sites-available/localxpress

sudo ln -sf /etc/nginx/sites-available/localxpress \
            /etc/nginx/sites-enabled/localxpress

# Deshabilitar el site por defecto si existe
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

### Paso 7 — Verificar despliegue completo

```bash
# Health del backend (desde el VPS)
curl http://127.0.0.1:3001/api/health

# A través de Nginx (desde fuera)
curl http://109.176.197.56/api/health
```

### Comandos de mantenimiento

```bash
# Ver logs en tiempo real
docker compose logs -f

# Reiniciar solo el backend
docker compose restart backend

# Actualizar tras un git pull
git pull
docker compose up -d --build

# Ver estado de los contenedores
docker compose ps

# Acceder a la base de datos
docker compose exec postgres psql -U localxpress localxpress

# Backup de la base de datos
docker compose exec postgres pg_dump -U localxpress localxpress > backup_$(date +%Y%m%d).sql

# Parar todo
docker compose down

# Parar y borrar volúmenes (⚠️ BORRA DATOS)
docker compose down -v
```

---

## Credenciales de prueba

> ⚠️ Estas credenciales son para desarrollo y primera puesta en marcha.
> Cámbialas antes de usar la aplicación con datos reales.

| Credencial | Valor |
|-----------|-------|
| DB User | `localxpress` |
| DB Password | `LxPostgr3s@2024Secure!` |
| DB Name | `localxpress` |
| JWT Secret | `lxJwtS3cr3t_7mK9pNqR4wXvB2cJ6hY3sZ8dF5tG0uA1eI_xProd2024` |
| B2B API Key | `lx-b2b-3f8a2d1e9c4b6f7d-K2pM5qR8vXnZ_prod2024` |
| Admin Email | `admin@localxpress.com` |
| Admin Password | `Admin_LX_2024!` |

Para regenerar el JWT Secret:
```bash
openssl rand -base64 48
```

---

## Variables de entorno

Ver [.env.example](.env.example) para descripción completa.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | ✅ | URL PostgreSQL |
| `JWT_SECRET` | ✅ | Mínimo 32 chars |
| `NODE_ENV` | ✅ | `production` en VPS |
| `PORT` | — | Default: 3001 |
| `CORS_ORIGIN` | — | URL frontend o IP VPS |
| `STORAGE_DIR` | — | Default: `./uploads` |
| `MAX_FILE_SIZE_MB` | — | Default: 10 |
| `API_KEY_CREATE_ORDER` | — | Para endpoint B2B |

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/health` | — | Estado servidor + DB |
| `POST` | `/api/auth/login` | — | Login → JWT |
| `GET` | `/api/auth/me` | JWT | Usuario actual |
| `POST` | `/api/auth/refresh` | JWT | Renovar token |
| `GET` | `/api/users` | Admin | Listar usuarios |
| `POST` | `/api/users` | Admin | Crear usuario |
| `GET` | `/api/users/lookup-email` | Admin | Buscar email por nombre |
| `GET` | `/api/users/:id` | Admin | Detalle usuario |
| `PATCH` | `/api/users/:id` | Admin | Actualizar usuario |
| `DELETE` | `/api/users/:id` | Admin | Eliminar usuario |
| `GET` | `/api/profiles/me` | JWT | Mi perfil |
| `PATCH` | `/api/profiles/me` | JWT | Actualizar mi perfil |
| `GET` | `/api/profiles` | Admin | Listar perfiles |
| `GET` | `/api/profiles/:id` | Admin | Perfil por ID |
| `PATCH` | `/api/profiles/:id` | Admin | Actualizar perfil |
| `GET` | `/api/stops` | JWT | Stops (filtrado por rol) |
| `POST` | `/api/stops` | Admin/Shop | Crear stop |
| `POST` | `/api/stops/order` | API Key | Crear stop B2B |
| `GET` | `/api/stops/:id` | JWT | Detalle stop |
| `PATCH` | `/api/stops/:id` | JWT | Actualizar stop |
| `DELETE` | `/api/stops/:id` | Admin/Shop | Eliminar stop |
| `GET` | `/api/driver-locations` | JWT | Ubicaciones drivers |
| `PUT` | `/api/driver-locations` | Driver | Actualizar posición propia |
| `GET` | `/api/driver-locations/:id` | Admin | Posición de driver |
| `DELETE` | `/api/driver-locations/cleanup` | Admin | Limpiar posiciones antiguas |
| `GET` | `/api/pricing-zones` | JWT | Zonas de precio |
| `POST` | `/api/pricing-zones` | Admin | Crear zona |
| `PATCH` | `/api/pricing-zones/:id` | Admin | Actualizar zona |
| `DELETE` | `/api/pricing-zones/:id` | Admin | Eliminar zona |
| `POST` | `/api/uploads/proof/:id` | Driver/Admin | Subir foto entrega |
| `GET` | `/api/uploads/proof/:id` | JWT | Ver fotos de stop |
| `DELETE` | `/api/uploads/proof/:id` | Admin | Borrar fotos de stop |

---

## Crear primer admin

### Con script (recomendado)

```bash
# Con Docker (en VPS)
docker compose exec backend npx tsx scripts/seed-admin.ts

# Sin Docker (local)
npx tsx scripts/seed-admin.ts admin@email.com MiPassword123!
```

### Directamente en psql

```bash
# Generar hash de contraseña
node -e "const b=require('bcryptjs'); b.hash('TuPassword',12).then(console.log)"

# En psql
INSERT INTO users (email, password_hash) VALUES ('admin@email.com', '<hash>');
INSERT INTO user_roles (user_id, role)
  SELECT id, 'admin' FROM users WHERE email = 'admin@email.com';
```

---

## Estructura

```
src/
├── config.ts              # Variables de entorno validadas con Zod
├── db.ts                  # Pool PostgreSQL + query/queryOne/withTransaction
├── index.ts               # Servidor Express (middlewares globales + rutas)
├── types.ts               # Tipos TypeScript compartidos
├── middleware/
│   ├── auth.ts            # requireAuth (JWT), requireApiKey
│   ├── roles.ts           # requireRole, requireAdmin, requireAdminOrShop
│   └── errorHandler.ts    # AppError + manejo de errores Zod/pg
├── routes/
│   ├── health.ts
│   ├── auth.ts            # login, me, refresh
│   ├── users.ts           # CRUD usuarios (admin)
│   ├── profiles.ts        # Perfiles
│   ├── stops.ts           # Pedidos/stops (con filtro por rol)
│   ├── driver-locations.ts
│   ├── pricing-zones.ts
│   └── uploads.ts         # Fotos de entrega
└── utils/
    ├── hash.ts            # bcrypt
    ├── jwt.ts             # sign/verify
    ├── response.ts        # Helpers HTTP (ok, created, noContent, ...)
    └── schemas.ts         # Esquemas Zod de validación de entrada
scripts/
└── seed-admin.ts          # Crear primer usuario admin
```
