# Akar CRM

Sistema CRM de ventas de Akar Automotores, construido a partir del mockup `Sistema_CRM_Akar_2.html`.

- **Stack:** Next.js 16 (App Router, Server Actions) + Supabase (Postgres, Auth, Row Level Security).
- **Roles:** Vendedor, Supervisor (acotado a sus sucursales) y Administrador. Los permisos se aplican en la base de datos con RLS, no solo en la interfaz.

## Qué incluye

| Vendedor | Supervisor / Administrador |
| --- | --- |
| **Inicio**: giras, comunicados, entregas, ranking del mes y *Mis alertas* con calendario | **Mensajes**: todas las conversaciones (el supervisor, las de sus sucursales), filtro por vendedor, asignar/reasignar |
| **Bandeja**: conversaciones propias, chat, notas, etiquetas, datos del lead, checklist de etapas, recordatorios | **Pipeline**: embudos por sector, estancados, cuello de botella (calculados en vivo) |
| **Test drive**: calendario de turnos por sucursal y solicitud (queda pendiente de aprobación) | **Seguimiento**: leads sin contacto de 1 semana a 18 meses, envío de plantilla |
| **Seguimiento**: cartera propia sin contacto y envío de plantilla | **Ranking** con filtros y detalle de ventas por vendedor |
| **Ranking** mensual con podio | **Test drives**: aprobar, rechazar, marcar realizado |
| | **Ventas**: listado filtrable, detalle, campos adicionales, alta manual |
| | **Panel general**: comunicados, giras y entregas |
| | **Vendedores**, **Horarios** y **Sucursales** (solo administrador): alta, edición, baja, horarios por fecha, reenvío de contraseña |

Otros comportamientos:

- Al marcar un lead como **Ganado** (o **Adjudicado** en Plan de ahorro) se registra la venta automáticamente; al desmarcarlo se elimina.
- La primera respuesta a un lead lo pasa de *Nuevo* a *Contactado*.
- Cuando un vendedor escribe en una conversación, el lead pasa a modo `humano` y el bot deja de responder.
- Cada mensaje muestra quién lo escribió: el ícono del bot o la foto/iniciales del vendedor.
- Los usuarios y las sucursales **no se borran**: se dan de baja (`activo = false`).
- Todas las fechas se muestran en hora de Argentina.

### Canales (WhatsApp, Instagram, Messenger)

Los leads de los canales los crea el **bot de n8n**, que escribe directo en Supabase. Desde el CRM solo se cargan a mano los leads de teléfono, visitas, etc. (**+ Nuevo lead**).

Los mensajes que escribe un vendedor quedan guardados con `estado_envio = 'pendiente'`: **el CRM no los manda a WhatsApp**. Los va a enviar n8n cuando esté conectado a Meta.

## Base de datos

El esquema es el que se armó junto con el bot (21 tablas + `modelos`), no el del primer borrador del CRM.

```
supabase/migrations/20260925000000_esquema_real.sql   Partes 1 a 5 (ya aplicadas en la base de prueba)
supabase/migrations/20260925000100_parte6_crm.sql     Parte 6: vínculo con Auth, permisos (RLS), vista bandeja
supabase/parte6/00..08_*.sql                           La Parte 6 en bloques chicos, para pegar en el SQL Editor
```

En la **base de prueba** hay que correr solamente los bloques de `supabase/parte6/`, en orden y de a uno (Supabase → SQL Editor → New query → Run). Cada archivo explica qué hace y qué resultado esperar. El Bloque 0 solo lee: sirve para confirmar los valores permitidos antes de cambiar nada.

Para una base **nueva** (por ejemplo, producción): `npx supabase link --project-ref <ref>` y `npx supabase db push`.

## Puesta en producción (Netlify)

1. Correr la Parte 6 en Supabase (ver arriba).
2. En Supabase → *Authentication → URL Configuration*: `Site URL` = la URL del sitio y agregar `https://TU-SITIO/restablecer` a *Redirect URLs*. Desactivar el registro público (*Allow new users to sign up*): los usuarios los crea el administrador.
3. Desplegar en Netlify: *Add new site → Import an existing project → GitHub → Jenn-ross-mk/CRM*. La configuración de build ya está en `netlify.toml`. Cargar las variables de `.env.example` en *Site configuration → Environment variables* y volver a desplegar. La `SUPABASE_SERVICE_ROLE_KEY` va **sin** `NEXT_PUBLIC_`: nunca llega al navegador.
4. Crear la primera cuenta: Supabase → *Authentication → Add user* con `jennifer.rossetti@akar.com.ar`, una contraseña y **Auto Confirm User** tildado. La base la vincula sola con su ficha de `usuarios` (por el email) y ya puede entrar como administradora.
5. Los demás usuarios se crean desde el CRM (**Vendedores → + Nuevo usuario**). A los que ya están en la base sin cuenta de login se les crea el acceso desde su ficha, poniendo una contraseña provisoria.
6. Configurar un proveedor SMTP propio en Supabase para los correos de restablecer contraseña (el de prueba tiene un límite muy bajo).

## Desarrollo local

Requisitos: Node 20+, Docker.

```bash
npm install
npx supabase start          # levanta Postgres + Auth locales y aplica las migraciones
cp .env.example .env.local  # completar con las claves que imprime `supabase start`
npm run dev                 # http://localhost:3000
```

## Estructura

```
supabase/migrations/     Esquema real + Parte 6
supabase/parte6/         Parte 6 en bloques para el SQL Editor
src/proxy.ts             Refresco de sesión y redirección a /login
src/app/login, restablecer
src/app/(app)/           Pantallas del vendedor (inicio, bandeja, test-drive, seguimiento, ranking)
src/app/(app)/gestion/   Consola de supervisor/administrador (incluye Horarios)
src/app/acciones/        Server Actions (todas las escrituras)
src/components/          Bandeja, calendario, ranking, seguimiento, UI común
src/lib/                 Supabase, sesión, consultas, fechas, constantes
```

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`, `npm run typecheck`
