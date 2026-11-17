#!/usr/bin/env bash
# restaurar.sh <carpeta>: descifra el respaldo de <carpeta> (esquema.sql.age y datos.sql.age) con la identidad de RESPALDO_CLAVE y lo
# carga en una base temporal de Supabase (base-temporal.sh, cargar.sh), que queda arriba para comprobar.sh. Antes de levantar nada
# comprueba que la identidad sea la pareja de RESPALDO_DESTINATARIO. Lo descifrado va a archivos de una carpeta privada que se borra al
# salir, no a `<(…)`: un fallo dentro de una sustitución de proceso no lo ve pipefail y dejaría cargar medio volcado. Lo llaman
# restauracion-semanal.yml y autoprueba.sh. Nunca imprime una variable RESPALDO_*.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/base-temporal.sh"

origen="${1:-}"
if [ -z "$origen" ]; then
  echo "Uso: restaurar.sh <carpeta>" >&2
  exit 2
fi
for variable in RESPALDO_CLAVE RESPALDO_DESTINATARIO; do
  if [ -z "${!variable:-}" ]; then
    echo "Falta $variable." >&2
    exit 2
  fi
done
for parte in esquema datos; do
  if [ ! -s "$origen/$parte.sql.age" ]; then
    echo "Falta $parte.sql.age en el respaldo o está vacío." >&2
    exit 2
  fi
done

privada=$(carpeta_temporal)
trap 'rm -rf "$privada"' EXIT
(
  umask 077
  printf '%s\n' "$RESPALDO_CLAVE" >"$privada/identidad.txt"
)
# El error de age-keygen no se muestra: podría citar la línea de la identidad.
if [ "$(age-keygen -y "$privada/identidad.txt" 2>/dev/null || true)" != "$RESPALDO_DESTINATARIO" ]; then
  echo "La clave de RESPALDO_CLAVE no es la pareja de RESPALDO_DESTINATARIO." >&2
  exit 1
fi

for parte in esquema datos; do
  age -d -i "$privada/identidad.txt" -o "$privada/$parte.sql" "$origen/$parte.sql.age"
done
levantar_temporal
bash "$RESPALDOS_DIR/cargar.sh" "$privada/esquema.sql" "$privada/datos.sql"
