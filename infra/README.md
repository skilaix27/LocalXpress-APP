# Infra — Despliegue en VPS

Guía paso a paso para desplegar LocalXpress en un VPS Ubuntu 22.04 / Debian 12.

## Requisitos previos

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql-16

# Nginx
sudo apt install -y nginx

# Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# PM2 o usar systemd (este repo usa systemd)
```

## 1. Base de datos

```bash
sudo -u postgres psql <<'SQL'
CREATE USER localxpress WITH PASSWORD 'change_this_password';
CREATE DATABASE localxpress OWNER localxpress;
SQL

# Aplicar migración inicial
psql "postgresql://localxpress:change_this_password@localhost/localxpress" \
  -f /var/www/localxpress/database/migrations/001_initial_schema.sql
```

## 2. Backend

```bash
cd /var/www/localxpress/backend

# Instalar dependencias
npm install --omit=dev

# Compilar TypeScript
npm run build

# Crear .env de producción
cp .env.example .env
nano .env   # ← editar DATABASE_URL, JWT_SECRET, CORS_ORIGIN, etc.
```

## 3. Systemd service

```bash
sudo cp infra/systemd/localxpress-backend.service.example \
        /etc/systemd/system/localxpress-backend.service

# Ajustar rutas si el proyecto no está en /var/www/localxpress
sudo nano /etc/systemd/system/localxpress-backend.service

sudo systemctl daemon-reload
sudo systemctl enable localxpress-backend
sudo systemctl start localxpress-backend
sudo systemctl status localxpress-backend
```

## 4. Frontend

```bash
cd /var/www/localxpress

# Añadir .env del frontend con la URL del backend propio:
echo "VITE_API_URL=https://yourdomain.com/api" > .env.production

npm install
npm run build
# Resultado en dist/
```

## 5. Nginx

```bash
sudo cp infra/nginx/localxpress.conf.example \
        /etc/nginx/sites-available/localxpress

sudo nano /etc/nginx/sites-available/localxpress
# ← Cambiar yourdomain.com por el dominio real

sudo ln -s /etc/nginx/sites-available/localxpress \
           /etc/nginx/sites-enabled/

sudo nginx -t && sudo systemctl reload nginx

# SSL con Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

## 6. Verificar despliegue

```bash
# Health del backend
curl https://yourdomain.com/api/health

# Logs en tiempo real
journalctl -u localxpress-backend -f
```

## Variables de entorno en producción

| Variable | Ejemplo |
|----------|---------|
| `DATABASE_URL` | `postgresql://localxpress:pass@localhost/localxpress` |
| `JWT_SECRET` | `$(openssl rand -base64 48)` |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `https://yourdomain.com` |
| `STORAGE_DIR` | `/var/www/localxpress/uploads` |
| `MAX_FILE_SIZE_MB` | `10` |
| `API_KEY_CREATE_ORDER` | `$(openssl rand -hex 32)` |
| `NODE_ENV` | `production` |

## Actualizaciones

```bash
cd /var/www/localxpress
git pull

# Backend
cd backend && npm install --omit=dev && npm run build
sudo systemctl restart localxpress-backend

# Frontend
cd .. && npm install && npm run build
# Nginx sirve dist/ directamente, no hace falta reiniciar
```
