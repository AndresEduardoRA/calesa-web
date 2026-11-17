# La pila temporal de Supabase de los respaldos (X13). Se carga con `source` desde volcar.sh, cargar.sh, restaurar.sh, comprobar.sh y
# autoprueba.sh; no se corre sola. La pila lee .github/respaldo/supabase/config.toml: sin migraciones ni semilla, con `auth`, `storage`
# y `extensions` de Supabase (un Postgres vacío no restaura `citext` ni la FK a `auth.users`), en los puertos 55340-55349. Es de una sesión
# a la vez y la baja quien la levanta.

RESPALDOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ_DEL_REPO="$(cd "$RESPALDOS_DIR/../.." && pwd)"
CONTENEDOR_TEMPORAL=supabase_db_calesa-restauracion

# Una carpeta privada (700) para lo que no se sube: identidades, volcados sin cifrar, la salida de error de la CLI. Quien la pide la
# borra con su `trap … EXIT`. Sirve con `set -u` aunque no estén RUNNER_TEMP ni TMPDIR.
carpeta_temporal() {
  local dir
  dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/respaldos.XXXXXX")
  chmod 700 "$dir"
  printf '%s\n' "$dir"
}

# La CLI de Supabase (la devDependency) sobre la pila temporal. Sin ninguna variable SUPABASE_* del entorno: bajo el candado de un
# carril, el .env.carril le cambiaría el project_id y los puertos, y la CLI las lee antes que config.toml.
supabase_temporal() {
  local quitar=() v
  for v in $(compgen -e); do
    if [[ $v == SUPABASE_* ]]; then quitar+=(-u "$v"); fi
  done
  (cd "$RAIZ_DEL_REPO" && env "${quitar[@]}" pnpm exec supabase "$@" --workdir "$RESPALDOS_DIR")
}

# Baja la pila temporal y borra sus volúmenes. No falla si no estaba arriba: sólo limpia.
bajar_temporal() {
  supabase_temporal stop --no-backup >/dev/null 2>&1 || true
}

# Levanta la pila temporal desde cero (la baja antes, por si una corrida anterior quedó cortada y con datos).
levantar_temporal() {
  bajar_temporal
  supabase_temporal start -x studio,imgproxy,edge-runtime,logflare,vector
}

# psql dentro del contenedor de la base temporal: el psql 17 de la imagen, el mismo que el pg_dump del volcado. Entra como
# `supabase_admin`, el superusuario de la imagen local (su clave es la de la pila local, pública): `postgres` no puede escribir en
# algunas tablas de la plataforma que el volcado de datos trae (`storage.buckets_vectors`, medido en P23), y la base es desechable.
psql_temporal() {
  if ! docker ps --filter "name=^${CONTENEDOR_TEMPORAL}\$" --format '{{.Names}}' | grep -qx "$CONTENEDOR_TEMPORAL"; then
    echo "No está la base temporal ($CONTENEDOR_TEMPORAL)." >&2
    return 1
  fi
  docker exec -i "$CONTENEDOR_TEMPORAL" psql "postgresql://supabase_admin:postgres@127.0.0.1:5432/postgres" "$@"
}
