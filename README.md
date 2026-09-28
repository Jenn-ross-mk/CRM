# Akar CRM

Sistema CRM de ventas de Akar Automotores, construido a partir del mockup `Sistema_CRM_Akar_2.html`.

- **Stack:** Next.js 16 (App Router, Server Actions) + Supabase (Postgres, Auth, Row Level Security).
- **Roles:** Vendedor, Supervisor (acotado a sus sucursales) y Administrador. Los permisos se aplican en la base de datos con RLS, no solo en la interfaz.

## Qué incluye

### Panel general (primera pantalla de todos los roles)

Los leads se ordenan en cuatro bloques. El administrador ve todos, el supervisor los de sus sucursales y el vendedor los suyos. Se filtra por día, semana o mes (o *Todo*): los leads abiertos por fecha de ingreso, los cerrados por fecha de cierre y los vendidos por fecha de venta. Cada lead abre su detalle al tocarlo.

| Bloque | Qué entra |
| --- | --- |
| **En seguimiento** (verde) | *Activos*: leads nuevos y conversaciones en curso. *Agendados*: tienen una llamada, test drive o visita agendada para después de hoy. |
| **Pendientes** (naranja) | La agenda es hoy o ya pasó y no se le escribió desde ese día, o el cliente no escribe hace 7 días o más (*Sin respuesta* si se le escribió, *Sin contacto* si no). |
| **Cerrados** (rojo) | Chats cerrados, con una etiqueta por motivo: Falta de dinero, Crédito rechazado, Usado no admitido, Compró en competencia. *Otros* (con texto obligatorio) solo lo puede usar el administrador. |
| **Vendidos** | Ventas registradas (automáticas al marcar Ganado/Adjudicado o cargadas a mano). |

- **Cerrar chat**: desde la conversación o desde el desplegable de cada lead del panel. El motivo es obligatorio y la base lo vuelve a controlar. El chat deja de verse en la bandeja y en Mensajes; el administrador o el supervisor lo pueden reabrir.
- **Reapertura automática**: si el cliente de un chat cerrado vuelve a escribir, la base lo reabre sola, con el mismo vendedor (o para asignación manual si ese vendedor está dado de baja) y con toda la conversación anterior. n8n tiene que guardar el mensaje en el lead que ya existe para ese contacto, sin crear uno nuevo.
- **Agendamientos** (antes *Test drive*): un calendario con todo lo del vendedor. Se agenda una *nota libre* (qué hay que hacer ese día), un test drive, una llamada o una visita. El test drive necesita aprobación; lo demás no. La vista del día muestra todo junto, ordenado por hora, y abajo están los próximos días. Reemplaza a *Mis alertas* del Inicio. Llamadas, visitas y test drives también se agendan desde la pestaña *Recordatorios* del chat.
- **Clientes**: listado de todos los clientes visibles (buscador y filtro por bloque del Panel general). Al tocar uno se abre su **perfil**: dónde está hoy (bloque, motivo y etapa), datos del cliente (modelo de interés, 0 km o usado, uso, para cuándo, preferencias, forma de pago, monto, usado que entrega, temperatura, prioridad; todos opcionales), primer mensaje, agendamientos, notas e historial. También se abre con "Ver perfil" desde el Panel general y desde el chat.
- **Reagendar**: desde el perfil, Agendamientos o el chat. El motivo es obligatorio: venta de su usado, falta de dinero para la entrega, financiación no conveniente, análisis de la operación, cambio de año o siniestro. Queda registrado en el historial. Un test drive reagendado vuelve a quedar pendiente de aprobación.
- **Vencido sin reagendar**: si pasa el día de un agendamiento y no se marcó realizado ni se reagendó, el cliente pasa a *Pendientes* con la etiqueta "Sin reagendar".
- **Alertas de agendamientos**: cada agendamiento crea una alerta para ese día (el test drive, cuando se aprueba). Ese día aparece un aviso al entrar al CRM y un ícono rojo en *Agendamientos* hasta marcarlas como resueltas. Si se cancela o se rechaza, la alerta se borra sola.
- Comunicados y giras (el panel anterior) pasaron a **Comunicados**. La sección *Entregas de la semana* se quitó.

### Pantallas

| Vendedor | Supervisor / Administrador |
| --- | --- |
| **Inicio**: giras, comunicados y ranking del mes | **Mensajes**: todas las conversaciones (el supervisor, las de sus sucursales), filtro por vendedor, asignar/reasignar |
| **Bandeja**: conversaciones propias, chat, notas, etiquetas, datos del lead, checklist de etapas, recordatorios | **Pipeline**: embudos por sector, estancados, cuello de botella (calculados en vivo) |
| **Agendamientos**: calendario con notas libres, test drives (con aprobación), llamadas y visitas; todo genera su alerta | **Seguimiento**: leads sin contacto de 1 semana a 18 meses, envío de plantilla |
| **Seguimiento**: cartera propia sin contacto y envío de plantilla | **Ranking** con filtros y detalle de ventas por vendedor |
| **Ranking** mensual con podio | **Test drives**: aprobar (recién ahí se crea la alerta del vendedor), rechazar, marcar realizado |
| | **Ventas**: listado filtrable, detalle, campos adicionales, alta manual |
| | **Comunicados**: comunicados y giras |
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
supabase/migrations/20260928000000_parte7_panel.sql    Parte 7: Panel general, cierre de leads, llamadas y visitas
supabase/parte7/01..06_*.sql                           La Parte 7 en bloques, para pegar en el SQL Editor
supabase/migrations/20260929000000_parte8_clientes.sql Parte 8: perfil del cliente y reagendamientos con motivo
supabase/parte8/01..03_*.sql                           La Parte 8 en bloques, para pegar en el SQL Editor
```

En la **base de prueba** hay que correr los bloques de `supabase/parte6/` (si todavía no se corrieron) y después los de `supabase/parte7/` y `supabase/parte8/`, en orden y de a uno (Supabase → SQL Editor → New query → Run). Cada archivo explica qué hace y qué resultado esperar. El Bloque 0 solo lee: sirve para confirmar los valores permitidos antes de cambiar nada.

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
src/app/(app)/           Panel general y pantallas del vendedor (inicio, bandeja, agendamientos, seguimiento, ranking)
src/app/(app)/gestion/   Consola de supervisor/administrador (incluye Horarios)
src/app/acciones/        Server Actions (todas las escrituras)
src/components/          Bandeja, calendario, ranking, seguimiento, UI común
src/lib/                 Supabase, sesión, consultas, fechas, constantes
```

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`, `npm run typecheck`
