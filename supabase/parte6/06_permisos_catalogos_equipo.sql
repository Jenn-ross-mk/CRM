-- =============================================================
-- Parte 6 · Bloque 6 — Permisos (RLS): catálogos y equipo
-- =============================================================
-- Qué hace: define quién puede leer y escribir cada tabla.
--   · Catálogos (sucursales, localidades, etapas, etiquetas, plantillas, modelos):
--     los lee cualquier usuario logueado; solo el admin los modifica.
--   · usuarios: todos ven al equipo (nombres, fotos, ranking); solo el admin modifica.
--     Cada vendedor cambia su propio estado con la función cambiar_mi_estado.
--   · horarios_vendedor: cada uno ve los suyos; admin y supervisores ven todos; solo el admin los carga.
--   · supervisor_sucursales: lectura para todos; solo el admin modifica.
-- n8n se conecta con la clave service_role, que no pasa por estos permisos.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → cada una de estas tablas tiene sus policies.

create policy sucursales_lectura on public.sucursales for select to authenticated using (true);
create policy sucursales_admin   on public.sucursales for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy localidades_lectura on public.localidades for select to authenticated using (true);
create policy localidades_admin   on public.localidades for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy etapas_lectura on public.etapas_pipeline for select to authenticated using (true);
create policy etapas_admin   on public.etapas_pipeline for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy etiquetas_lectura on public.etiquetas for select to authenticated using (true);
create policy etiquetas_admin   on public.etiquetas for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy plantillas_lectura on public.plantillas for select to authenticated using (true);
create policy plantillas_admin   on public.plantillas for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy modelos_lectura on public.modelos for select to authenticated using (true);
create policy modelos_admin   on public.modelos for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy usuarios_lectura on public.usuarios for select to authenticated using (true);
create policy usuarios_admin   on public.usuarios for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy horarios_lectura on public.horarios_vendedor for select to authenticated
  using (usuario_id = public.mi_usuario_id() or public.es_gestion());
create policy horarios_admin on public.horarios_vendedor for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy supervisor_sucursales_lectura on public.supervisor_sucursales for select to authenticated using (true);
create policy supervisor_sucursales_admin   on public.supervisor_sucursales for all    to authenticated using (public.es_admin()) with check (public.es_admin());
