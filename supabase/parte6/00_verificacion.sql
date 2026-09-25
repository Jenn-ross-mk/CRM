-- =============================================================
-- Parte 6 · Bloque 0 — VERIFICACIÓN (solo lee, no cambia nada)
-- =============================================================
-- Muestra todas las reglas "check" de la base (los valores permitidos en cada campo).
-- En el registro de la conversación algunas de estas líneas quedaron cortadas, así que
-- antes de seguir hay que confirmar los valores exactos.
--
-- Resultado esperado: una tabla con 3 columnas (tabla, regla, definicion).
-- Copiá TODO el resultado y pegáselo a Claude antes de correr el Bloque 1.

select conrelid::regclass as tabla,
       conname            as regla,
       pg_get_constraintdef(oid) as definicion
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype = 'c'
order by 1, 2;
