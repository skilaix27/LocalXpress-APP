# Infra — Despliegue en VPS 109.176.197.56

Guía completa para desplegar LocalXpress en Ubuntu 22.04 / Debian 12.

---

## Arquitectura de producción

```
Internet → :80/:443
             │
          Nginx (host)
             │  proxy_pass
             ▼
     127.0.0.1:3001
     ┌──────────────────────────────┐
     │   Docker Compose             │
     │  ┌─────────┐  ┌───────────┐ │
     │  │ backend │  │ postgres  │ │
     │  │ :3001   │◄─│ :5432     │ │
     │  └─────────┘  │ (interno) │ │
     │               └───────────┘ │
     └──────────────────────────────┘
```

- PostgreSQL NO expone ningún puerto al exterior.
- El backend expone el 3001 solo en `127.0.0.1` (solo accesible desde el propio VPS).
- Nginx actúa como proxy inverso y sirve el frontend estático.

---

## 1. Preparar el VPS

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # o cerrar sesión y volver

# Instalar Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Verificar Docker
docker --version
docker compose version
```

---

## 2. Clonar el proyecto

```bash
sudo mkdir -p /var/www/localxpress
sudo chown $USER:$USER /var/www/localxpress

git clone https://github.com/TU_USUARIO/LocalXpress-APP.git /var/www/localxpress
cd /var/www/localxpress
```

---

## 3. Verificar .env del backend

El proyecto ya incluye `backend/.env` con credenciales de prueba funcionales.
Está excluido del repositorio git (`.gitignore`), así que debes crearlo en el servidor.

```bash
# Opción A: usar las credenciales de prueba (puesta en marcha rápida)
cat backend/.env   # verificar que existe

# Opción B: copiar la plantilla y editar valores
cp backend/.env.example backend/.env
nano backend/.env
```

Variables mínimas obligatorias:
```
NODE_ENV=production
DATABASE_URL=...  (sobreescrita automáticamente por docker-compose.yml)
JWT_SECRET=...    (mínimo 32 caracteres)
CORS_ORIGIN=http://109.176.197.56
```

---

## 4. Levantar servicios con Docker Compose

```bash
cd /var/www/localxpress

# Primera vez (construye la imagen y aplica migración SQL)
docker compose up -d --build

# Verificar estado
docker compose ps
```

Output esperado:
```
NAME                    STATUS          PORTS
localxpress-backend     Up (healthy)    127.0.0.1:3001->3001/tcp
localxpress-db          Up (healthy)
```

---

## 5. Crear el usuario admin

```bash
docker compose exec backend npx tsx scripts/seed-admin.ts

# Con email y password personalizados:
docker compose exec backend npx tsx scripts/seed-admin.ts tu@email.com MiPassword123!
```

---

## 6. Configurar Nginx

```bash
# Copiar configuración
sudo cp /var/www/localxpress/infra/nginx/localxpress.conf.example \
        /etc/nginx/sites-available/localxpress

# Activar site
sudo ln -sf /etc/nginx/sites-available/localxpress \
            /etc/nginx/sites-enabled/localxpress

# Deshabilitar el site por defecto si interfiere
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar y recargar
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Verificar despliegue

```bash
# Health desde el VPS (directo al backend)
curl http://127.0.0.1:3001/api/health

# Health a través de Nginx (como lo vería el navegador)
curl http://109.176.197.56/api/health

# Test de login
curl -X POST http://109.176.197.56/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localxpress.com","password":"Admin_LX_2024!"}'
```

---

## 8. Comandos de mantenimiento

```bash
# Logs en tiempo real
docker compose logs -f
docker compose logs -f backend
docker compose logs -f postgres

# Reiniciar servicios
docker compose restart backend
docker compose restart

# Actualizar código
cd /var/www/localxpress
git pull
docker compose up -d --build   # reconstruye solo si cambió el código

# Estado de contenedores
docker compose ps

# Backup de base de datos
docker compose exec postgres pg_dump -U localxpress localxpress \
  > /var/backups/localxpress_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker compose exec -T postgres psql -U localxpress localxpress \
  < /var/backups/localxpress_20240101_120000.sql

# Acceder a psql
docker compose exec postgres psql -U localxpress localxpress

# Parar todo (datos se conservan en volúmenes)
docker compose down

# Parar y BORRAR DATOS (⚠️ irreversible)
docker compose down -v
```

---

## 9. SSL con Let's Encrypt (cuando tengas dominio)

```bash
# Obtener certificado
sudo certbot --nginx -d tudominio.com

# El certificado se renueva automáticamente. Verificar:
sudo certbot renew --dry-run

# Actualizar CORS_ORIGIN en backend/.env
nano /var/www/localxpress/backend/.env
# CORS_ORIGIN=https://tudominio.com

docker compose restart backend
```

Descomentar la sección HTTPS en `infra/nginx/localxpress.conf.example` y recargar Nginx.

---

## 10. Seguridad adicional recomendada

```bash
# Firewall básico con UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verificar que el puerto 5432 NO es accesible desde fuera
sudo ufw status   # 5432 no debe aparecer

# Fail2ban (bloquea IPs con demasiados intentos fallidos)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

---

## Credenciales de prueba incluidas

> ⚠️ Son credenciales de primera puesta en marcha. Cámbialas en producción real.

| Servicio | Usuario | Contraseña |
|---------|---------|-----------|
| PostgreSQL | `localxpress` | `LxPostgr3s@2024Secure!` |
| Admin App | `admin@localxpress.com` | `Admin_LX_2024!` |
| JWT Secret | — | `lxJwtS3cr3t_7mK9pNqR4wXvB2cJ6hY3sZ8dF5tG0uA1eI_xProd2024` |
| B2B API Key | — | `lx-b2b-3f8a2d1e9c4b6f7d-K2pM5qR8vXnZ_prod2024` |
