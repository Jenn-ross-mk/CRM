# Akar CRM

Sistema CRM de ventas de Akar Automotores, construido a partir del mockup `Sistema_CRM_Akar_2.html`.

- **Stack:** Next.js 16 (App Router, Server Actions) + Supabase (Postgres, Auth, Row Level Security).
- **Roles:** Vendedor, Supervisor (acotado a su sucursal) y Administrador. Los permisos se aplican en la base de datos con RLS, no solo en la interfaz.

## Qué incluye

| Vendedor | Supervisor / Administrador |
| --- | --- |
| **Inicio**: giras, comunicados, entregas, ranking del mes y *Mis alertas* con calendario | **Mensajes**: todas las conversaciones (el supervisor, las de su sucursal), filtro por vendedor, asignar/reasignar |
| **Bandeja**: conversaciones propias, chat, notas, etiquetas, datos del lead, checklist de etapas, recordatorios | **Pipeline**: embudos por sector, estancados, cuello de botella (calculados en vivo) |
| **Test drive**: calendario de turnos por sucursal y solicitud (queda pendiente de aprobación) | **Seguimiento**: leads sin contacto de 1 semana a 18 meses, envío de plantilla |
| **Seguimiento**: cartera propia sin contacto y envío de plantilla | **Ranking** con filtros y detalle de ventas por vendedor |
| **Ranking** mensual con podio | **Test drives**: aprobar, rechazar, marcar realizado |
| | **Ventas**: listado filtrable, detalle, campos adicionales, alta manual |
| | **Panel general**: comunicados, giras y entregas |
| | **Vendedores** y **Sucursales** (solo administrador): alta, edición, baja, reenvío de contraseña |

Otros comportamientos:

- Al marcar un lead como **Ganado** (o **Adjudicado** en Plan de ahorro) se registra la venta automáticamente; al desmarcarlo se elimina.
- La primera respuesta a un lead lo pasa de *Nuevo* a *Contactado*.
- Todas las fechas se muestran en hora de Argentina.

### Canales (WhatsApp, Instagram, web…)

Por ahora los leads se cargan a mano (**+ Nuevo lead**) o con los datos de prueba. Los mensajes que se envían desde el CRM quedan registrados en la conversación pero **todavía no salen por ningún canal**.

Para conectar canales más adelante ya está listo el endpoint `POST /api/webhooks/mensajes` (header `x-webhook-secret`):

```bash
curl -X POST https://TU-DOMINIO/api/webhooks/mensajes \
  -H 'content-type: application/json' -H 'x-webhook-secret: TU_SECRETO' \
  -d '{"telefono":"+54 9 297 400-0000","nombre":"Cliente","canal":"WhatsApp","texto":"Hola!","sucursal":"Centro"}'
```

Si el teléfono ya existe, agrega el mensaje a esa conversación; si no, crea un lead **sin asignar** que aparece en *Mensajes* para asignarlo.

## Puesta en marcha local

Requisitos: Node 20+, Docker.

```bash
npm install
npx supabase start          # levanta Postgres + Auth locales y aplica las migraciones
cp .env.example .env.local  # completar con las claves que imprime `supabase start` (API URL, anon key, service_role key)
npm run seed                # carga datos de prueba
npm run dev                 # http://localhost:3000
```

Usuarios de prueba (contraseña `Akar2026!`):

- Administradora: `jennifer.rossetti@akarautomotores.com.ar`
- Supervisores: `r.medina@akarautomotores.com.ar` (Centro), `l.funes@akarautomotores.com.ar` (Norte)
- Vendedores: `m.gonzalez@…`, `c.ibarra@…`, `j.perotti@…` y el resto con el mismo formato `@akarautomotores.com.ar`

> ⚠️ `npm run seed` **borra todos los datos** antes de cargar los de prueba. No correrlo contra producción.

## Puesta en producción

1. Crear un proyecto en [Supabase](https://supabase.com) y aplicar las migraciones: `npx supabase link --project-ref <ref>` y `npx supabase db push`.
2. En Supabase → *Authentication → URL Configuration*: `Site URL` = la URL del sistema y agregar `https://TU-DOMINIO/restablecer` a *Redirect URLs*. Desactivar el registro público (*Allow new users to sign up*): los usuarios los crea el administrador.
3. Configurar un proveedor SMTP propio en Supabase para los correos de restablecer contraseña (el de prueba tiene un límite muy bajo).
4. Desplegar en Vercel (u otro host de Next.js) con las variables de `.env.example`.
5. Crear la primera cuenta de administrador: desde Supabase → *Authentication → Add user*, y después en SQL: `update perfiles set rol = 'administrador' where email = '…';`

## Estructura

```
supabase/migrations/     Esquema, RLS, vista de bandeja
scripts/seed.mjs         Datos de prueba
src/proxy.ts             Refresco de sesión y redirección a /login
src/app/login, restablecer
src/app/(app)/           Pantallas del vendedor (inicio, bandeja, test-drive, seguimiento, ranking)
src/app/(app)/gestion/   Consola de supervisor/administrador
src/app/acciones/        Server Actions (todas las escrituras)
src/app/api/webhooks/    Entrada de mensajes de canales externos
src/components/          Bandeja, calendario, ranking, seguimiento, UI común
src/lib/                 Supabase, sesión, consultas, fechas, constantes
```

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`, `npm run typecheck`
- `npm run seed`
