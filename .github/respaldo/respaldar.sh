#!/usr/bin/env bash
# respaldar.sh <carpeta>: vuelca la base de RESPALDO_DB_URL (volcar.sh: esquema y datos) y cifra cada parte con age para
# RESPALDO_DESTINATARIO, en la tubería: del lado del respaldo nada queda sin cifrar en el disco. Deja <carpeta>/esquema.sql.age y
# <carpeta>/datos.sql.age. Lo llaman respaldo-diario.yml y autoprueba.sh. Nunca imprime una variable RESPALDO_*.
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

destino="${1:-}"
if [ -z "$destino" ]; then
  echo "Uso: respaldar.sh <carpeta>" >&2
  exit 2
fi
for variable in RESPALDO_DB_URL RESPALDO_DESTINATARIO; do
  if [ -z "${!variable:-}" ]; then
    echo "Falta $variable." >&2
    exit 2
  fi
done
if [[ $RESPALDO_DESTINATARIO != age1* ]]; then
  echo "RESPALDO_DESTINATARIO no es un destinatario de age (empieza por age1)." >&2
  exit 2
fi

mkdir -p "$destino"
for parte in esquema datos; do
  bash "$aqui/volcar.sh" "$parte" | age -r "$RESPALDO_DESTINATARIO" -o "$destino/$parte.sql.age"
done
echo "Respaldo cifrado en $destino: esquema.sql.age y datos.sql.age."
