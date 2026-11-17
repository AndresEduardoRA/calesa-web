#!/usr/bin/env bash
# volcar.sh <esquema|datos>: escribe por stdout esa parte del volcado de la base de RESPALDO_DB_URL, con el pg_dump 17 de la CLI de
# Supabase (`supabase db dump`, como la guía de respaldos de Supabase): el esquema, o los datos con COPY. Los roles no se vuelcan: el
# proyecto no crea roles propios, y los globales de la plataforma (`GRANT SET ON PARAMETER …`) no se pueden recrear en otra base de
# Supabase. Lo llaman respaldar.sh (que lo cifra en la tubería) y autoprueba.sh. La salida de error de la CLI va a una carpeta privada
# que no se sube; si falla, se imprime su final sin cadenas de conexión (pg_dump nombra objetos, no valores de filas).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/base-temporal.sh"

parte="${1:-}"
case "$parte" in
  esquema) opciones=() ;;
  datos) opciones=(--data-only --use-copy) ;;
  *)
    echo "Uso: volcar.sh <esquema|datos>" >&2
    exit 2
    ;;
esac
if [ -z "${RESPALDO_DB_URL:-}" ]; then
  echo "Falta RESPALDO_DB_URL." >&2
  exit 2
fi

privada=$(carpeta_temporal)
trap 'rm -rf "$privada"' EXIT
rc=0
supabase_temporal db dump --db-url "$RESPALDO_DB_URL" "${opciones[@]}" 2>"$privada/error" || rc=$?
if [ "$rc" -ne 0 ]; then
  echo "supabase db dump ($parte) falló con $rc." >&2
  tail -n 20 "$privada/error" | sed -E "s#postgres(ql)?://[^[:space:]\"']*#<cadena>#g" >&2
  exit "$rc"
fi
