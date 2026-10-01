# Bot de Akar en n8n — cómo seguir (traspaso entre sesiones)

Este documento resume una sesión de trabajo con Claude para reconstruir el bot de WhatsApp/Instagram/Messenger
de Akar en n8n, conectado a este CRM. **Una sesión nueva debe leer esto antes de hacer nada.**

## Cómo trabajar con la usuaria (muy importante)

- **Ella arma el bot con sus manos en n8n.** Claude NO arma archivos para importar: la guía clic por clic, un paso por mensaje, y espera que ella le diga que lo hizo.
- **Todo código (SQL, expresiones, etc.) se pega completo en el chat.** Nunca mandarla a copiar archivos de GitHub ni de otro lado.
- Ella **no es técnica**. Explicar todo en palabras simples, **de a un paso**, y esperar su respuesta.
- **No decidir nada por cuenta propia** ni crear, subir o borrar cosas sin explicar antes y tener su OK.
- **No inventar.** Si algo no se puede comprobar o no funciona, decirlo claramente en vez de emparchar.
- **Mantener la estructura original** de los workflows: corregir solo lo necesario.
- Hay **fecha límite**: priorizar construir el bot. Los nombres (por ejemplo el path del webhook, "bot V1") se definen después.
- Las credenciales (claves de Meta, OpenAI, n8n, Supabase) **se cargan al final**.
- Las versiones de prueba viejas (BT_flujo_madre, BT_get_cars, BT_derivar_humano) **no se usan ni como referencia**.

## Dónde se arma

En una cuenta **nueva** de n8n Cloud (botakar.app.n8n.cloud), vacía. Se empieza desde cero: no se reutilizan webhooks, credenciales ni nada del n8n viejo (akar-n8n…), que queda como está.

## Los workflows originales

Son 28 workflows exportados de n8n que la usuaria pegó en el chat (no están en el repositorio).
Siguen en el historial de la sesión original. En una sesión nueva, **pedirle que los vuelva a pegar**, empezando por "01. Flujo madre".
Dos de ellos tenían claves escritas dentro: hay que borrarlas antes de pegarlos.
- *BT_derivar_humano*: token de Meta en el nodo `register_number_meta`. Este workflow no se usa.
- *Workflows_backups*: API key de n8n en el nodo `Return N8N Workflows`.

Carpetas en n8n:
- **Sistema…:** 01. Flujo madre, 02. Optimizacion_constante, 04. registrar_leads, 05. Buscar_vehiculos_baserow,
  08. Derivar_a_humano, 10. info_general, Notificador_errores, Dasboard_update_messenger_instagram,
  update_dashboard_center, registra_leads_recuperar_baserrow, Workflows_backups.
- **Seguimi…:** Control de Seguimientos, Seguimiento 1 Lead Tibio/Caliente, Seguimiento 2 Lead Tibio/Caliente,
  Seguimiento 1 a Leads Frios, aviso_vendedor, S1 - Lead Frio, S1 Lead Tibio/Caliente, S2 Lead Tibio/Caliente,
  RG, RP1, RP2, IC1, IC2.
- **back_tes…:** BT_flujo_madre, BT_derivar_humano, BT_get_cars, recuperar_reagsignar_leads.

Vista del bot original para revisarlo nodo por nodo (artifact privado de la usuaria):
https://claude.ai/artifact/NvxiC3qC3ysyLCL98LiBZV

## Reglas decididas

1. **Canales:** Chatwoot se elimina. Meta (WhatsApp, Instagram, Messenger) le manda los mensajes directo a n8n.
   - En Instagram y Messenger el cliente se identifica por canal + el número que asigna Meta (`contactos.canal_id`).
   - El bot no pide el teléfono en Instagram ni Messenger: lo pide el vendedor después.
2. **Baserow se mantiene** para el stock 0km (tabla 11), la información general (16), los ejemplos de anuncios (18) y las consultas sin respuesta (4).
   - La ficha del cliente pasa al CRM.
   - Ya no hay base de usados: la tabla 12 no se usa.
3. **Qué hace el bot según lo que busca el cliente:**
   - 0km (convencional / plan de ahorro): conversa completo, califica, muestra stock, pide nombre y localidad, y deriva.
   - Usados: pregunta qué busca; cuando pregunta por un vehículo, pide nombre y localidad y deriva a Usados.
   - Postventa y repuestos: pregunta la consulta, el nombre y la localidad, y deriva al área.
   - Los mensajes predeterminados los escribe la usuaria.
4. **Reparto al derivar:** sucursal (según la localidad) → sector → vendedores dentro de su horario → el que menos leads tiene en el día.
   - La cuenta vuelve a cero cada mañana.
   - Usados, postventa y repuestos van solo a vendedores de esa área.
5. **Fuera de horario:** el bot conversa igual. Antes de derivar le recuerda el horario y le avisa que un asesor lo contacta en esa franja.
   - El lead queda en cola y se asigna cuando entra el primer vendedor de su turno (`procesar_cola`).
6. **Otras zonas:** el bot avisa dónde está Akar (sucursales en Comodoro, Madryn, Trelew y Esquel; también atiende localidades de Santa Cruz y Río Negro) y pregunta si quiere seguir.
   - Si acepta, queda sin vendedor ("Sin asignar" en Mensajes) para los administradores.
   - La lista de zonas cercanas se arma más adelante.
   - La pantalla de Mensajes del CRM queda como está.
7. **Etiqueta "humano":** al ponerla, el bot se calla. Al sacarla, el bot vuelve solo si el lead no tiene vendedor.
8. **Seguimientos:** 2, iguales para todos, a los **30 minutos** y a las **2 horas** sin respuesta del cliente.
   - Se mandan como texto común, solo de 7 a 22 h. Fuera de esa franja el bot igual contesta si el cliente escribe.
   - Solo para clientes que atiende el bot.
   - Los textos los escribe la usuaria.
   - Reemplazan a Control de Seguimientos y a los tres workflows "Seguimiento".
9. **Plantillas nuevas de Meta** para retomar conversaciones después de las 24 h. Reemplazan a S1, S2, RG, RP1, RP2, IC1 e IC2.
10. **Pruebas** con el chat de prueba de n8n.
    - Se guardan de forma temporal (contactos `es_prueba`, se borran con `bot_borrar_pruebas`) y se pueden ver en el CRM mientras existen.
    - En prueba no se asignan vendedores reales, no se mandan mails ni se envía nada a Meta.
11. **Para más adelante:**
    - Cambiar todas las claves.
    - Armar la lista de zonas.
    - Decidir sobre las métricas (update_dashboard_center, Dasboard_update…), aviso_vendedor, registra_leads_recuperar, recuperar_reagsignar_leads y Notificador_errores (la casilla de mail).

## Confirmado por la usuaria

1. **Al derivar, el bot deja de responder siempre.** Antes avisa que deriva y, si es fuera de horario, informa el horario de atención.
2. **Los 2 seguimientos son 2 en total por cliente** (no se reinician).
3. **Cliente enojado o que pide un responsable** (motivo "problema"): va a "Sin asignar" con la etiqueta **"urgente"** (roja), que pone el bot.

## Lo que ya está hecho

- `supabase/migrations/20261001000000_parte9_bot.sql` (Parte 9). Funciones que llama n8n:
  - `bot_registrar_entrante`, `bot_registrar_saliente`, `bot_actualizar_ficha`, `bot_derivar`;
  - `bot_leads_para_seguimiento` y `bot_registrar_seguimiento`;
  - `bot_borrar_pruebas`;
  - las etiquetas "humano" (con su trigger) y "urgente", y `contactos.es_prueba`.
  - **Ya se ejecutó en el Supabase del CRM de prueba (1/10/2026, "Success").** No volver a ejecutarla.
- `supabase/tests/parte9_bot_test.sql`: 35 pruebas. Todas pasan en una copia local del CRM (Postgres 16 con las migraciones 1 a 9).

- `supabase/migrations/20261002000000_parte10_archivos.sql` (Parte 10): carpeta privada "mensajes" en Supabase Storage para las fotos, audios y PDF de los clientes. Cada usuario abre solo los archivos de los mensajes que puede ver. n8n sube con service_role y guarda la ruta en `mensajes.media_url`. Prueba: `supabase/tests/parte10_archivos_test.sql`. **Ya se ejecutó en el Supabase del CRM de prueba ("Success").**
  - Mensajes del CRM ya muestra esos archivos (foto en miniatura, audio para escuchar, documento con enlace) con un enlace temporal. Publicado.

- `supabase/migrations/20261003000000_parte11_juntar_mensajes.sql` (Parte 11): **Redis no se usa**. Decisión de la usuaria: el bot junta los mensajes seguidos usando el CRM. Después de esperar 30 s, `bot_mensajes_pendientes(lead, mensaje)` dice si es el último mensaje del cliente y devuelve todos los mensajes sin contestar juntos (y el modo, por si lo derivaron durante la espera). `bot_guardar_transcripcion` guarda la descripción de fotos / transcripción de audios en la tabla `mensaje_transcripciones`, **solo para el bot** (decisión de la usuaria: los vendedores no la ven). Prueba: `supabase/tests/parte11_juntar_mensajes_test.sql`. **Ya se ejecutó en Supabase ("Success").**

- `supabase/migrations/20261004000000_parte12_memoria_bot.sql` (Parte 12): tabla `n8n_chat_histories` (memoria de la IA, clave `canal:canal_id`) creada de antemano con seguridad activada y sin acceso desde el CRM; `bot_borrar_pruebas` también borra la memoria de las pruebas. Prueba: `supabase/tests/parte12_memoria_bot_test.sql`. **Ya se ejecutó en Supabase ("Success").**
- **Baserow:** se usa el mismo del bot viejo (`https://akar-baserow.concesionariaakar.shop`), credencial "Baserow Akar" en n8n. Base 2; tablas 11 (stock 0km), 16 (info general), 18 (ejemplos de anuncios), 4 (consultas sin respuesta).
- **n8n (bot V1) hecho hasta "Variables":** chat de prueba → Ordenar datos → ¿Tiene archivo? → (Subir archivo) → Guardar mensaje en CRM → ¿Humano o no? → ¿Audio, Texto o Imagen? → [Texto] Esperar Último Input (30 s) → Obtener Inputs → ¿Es el último? → resp_marketing_ads → mensaje y respuesta → Aggregate → Variables. Faltan: ramas Imagen/pdf/Audio, AI Agent y lo que sigue.

- **Modelo de la IA:** decisión de la usuaria: **Google Gemini** (gemini-2.5-flash, estable, temperatura 0) en lugar de OpenAI gpt-4.1. Si responde mal en las pruebas, se cambia el nodo por OpenAI o un Gemini "pro". Prompt adaptado: `bot/prompt_flujo_madre.md`.

## Próximos pasos (en orden)

1. Flujo madre en n8n, respetando su estructura. Cambios:
   - entrada del chat de prueba;
   - guardar los mensajes en el CRM con `bot_registrar_entrante`;
   - "¿Humano o no?" usa `leads.modo`;
   - Redis y la memoria con clave por canal + id;
   - el envío queda preparado para Meta.
2. Herramientas: 05 (solo 0km), 10, 02, 08 (con `bot_derivar`) y 04 (con `bot_actualizar_ficha`).
3. Workflow de los 2 seguimientos.
4. Envío a Meta, incluidos los mensajes que escriben los vendedores en el CRM (hoy quedan "pendiente").
5. Al final: credenciales, ejecutar la Parte 9 en Supabase, conectar el webhook de Meta y probar.

Errores del bot viejo que hay que evitar (detalle en la conversación original):
- clientes de IG/Messenger mezclados por usar el teléfono como identificador;
- deduplicación que no se usaba;
- "Seguimiento 2" con nodos desactivados;
- aviso_vendedor que leía `vendedor_respondio` en lugar de `hub_respuesta`;
- la marca guardada como una sola letra (`Marca[0]`);
- motivo de derivación inválido que dejaba al lead sin derivar;
- prompt con instrucciones contradictorias.
