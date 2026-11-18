#!/usr/bin/env bash
# cargar.sh <esquema.sql> <datos.sql>: carga un volcado sin cifrar en la base temporal (base-temporal.sh), en una sola
# transacción y con `session_replication_role = replica` antes de los datos, como la guía de restauración de Supabase. Lo llaman
# restaurar.sh (después de descifrar) y autoprueba.sh. Con VERBOSITY=sqlstate un error sale como «ERROR:  <SQLSTATE>», sin el mensaje:
# el de un COPY o un tipo trae el valor de la fila, y los logs del CI pueden ser públicos. La salida normal no se muestra.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/base-temporal.sh"

if [ "$#" -ne 2 ]; then
  echo "Uso: cargar.sh <esquema.sql> <datos.sql>" >&2
  exit 2
fi
for archivo in "$@"; do
  if [ ! -s "$archivo" ]; then
    echo "Falta el volcado $(basename "$archivo") o está vacío." >&2
    exit 2
  fi
done

{
  cat "$1"
  echo 'set session_replication_role = replica;'
  cat "$2"
} | psql_temporal -X -q -f - --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate >/dev/null
echo "Volcado cargado en la base temporal."
