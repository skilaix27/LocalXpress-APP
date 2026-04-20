# LocalXpress — contexto del proyecto

## Qué es
Aplicación web para gestión logística de última milla en Barcelona.

## Stack actual
- Frontend: React + Vite + TypeScript
- UI: shadcn/ui + Tailwind
- Backend actual: Supabase/Lovable
- Supabase actual:
  - supabase/functions
  - supabase/migrations

## Objetivo
Migrar esta aplicación para:
- mantener la UI actual
- eliminar dependencia de Supabase/Lovable
- crear backend propio
- usar PostgreSQL propio
- desplegar finalmente en un VPS propio
- añadir más adelante storage propio para fotos, realtime y n8n

## Arquitectura objetivo
- frontend: React + Vite + TypeScript
- backend: Node.js + Express + TypeScript
- database: PostgreSQL
- storage: MinIO o compatible S3
- realtime: Socket.io
- proxy: Nginx
- automatizaciones: n8n

## Reglas
- no cambiar la UI salvo necesidad técnica
- no romper componentes visuales
- migrar por fases
- primero analizar, luego modificar
- separar frontend, backend y database
- no depender de Supabase en la arquitectura final

## Prioridades
1. Detectar todos los usos de Supabase
2. Resumir tablas y operaciones actuales
3. Crear backend mínimo propio
4. Crear esquema PostgreSQL mínimo
5. Migrar auth
6. Migrar pedidos
7. Migrar fotos
8. Migrar realtime

## Entidades mínimas esperadas
- users
- profiles
- orders
- order_status_history
- order_photos

## Lo que necesito de Claude Code
- auditar este repositorio
- identificar dependencias de Supabase
- revisar migraciones SQL
- crear documentación de migración
- crear backend mínimo en /backend
- crear esquema SQL mínimo en /database/migrations