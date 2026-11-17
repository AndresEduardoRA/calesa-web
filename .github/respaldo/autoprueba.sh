#!/usr/bin/env bash
# autoprueba.sh: la prueba de punta a punta de los respaldos (X13), sin secretos. Respalda la base local del stack (el del proyecto en
# CI, el del carril con su .env.carril), lo restaura en la base temporal y comprueba; y la comprobación tiene que caer sin solicitudes y
# sin una tabla de P02. Con age prueba también el cifrado y que una identidad que no es la pareja no se acepta; sin age y fuera de CI
# prueba lo mismo sin cifrar (en CI, sin age, cae). Resetea la base del stack, así que corre bajo su candado, igual en local y en CI:
#
#   bash scripts/candado.sh respaldos -- bash .github/respaldo/autoprueba.sh
#
# Da por hecho que el stack está arriba. La lanza el job `autoprueba` de restauracion-semanal.yml en los PR que tocan los respaldos o
# las migraciones.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/base-temporal.sh"
cd "$RAIZ_DEL_REPO"

falla() {
  echo "::error::$*" >&2
  exit 1
}
paso() { printf '\n== %s ==\n' "$*"; }
# tiene_que_caer <texto> <qué> <comando…>: el comando tiene que caer y su salida decir <texto>. Los mensajes nombran <qué>, nunca el
# comando (puede llevar una identidad, aunque sea desechable).
tiene_que_caer() {
  local texto="$1" que="$2" salida
  shift 2
  if salida=$("$@" 2>&1); then falla "$que pasó y tenía que caer"; fi
  grep -qF "$texto" <<<"$salida" || falla "$que cayó sin decir «$texto»: $salida"
}

privada=$(carpeta_temporal)
trap 'rm -rf "$privada"; bajar_temporal' EXIT
export RESPALDO_DB_URL="postgresql://postgres:postgres@127.0.0.1:${SUPABASE_DB_PORT:-55322}/postgres"
MIGRACIONES_DE_P02=(
  supabase/migrations/20261117024000_calesa_tablas_panel.sql
  supabase/migrations/20261117024003_calesa_tablas_sitio.sql
  supabase/migrations/20261117024006_calesa_permisos.sql
)

paso "1. comprobar.sql lista las tablas de P02"
grep -oE "^    '[a-z_]+',?$" .github/respaldo/comprobar.sql | tr -d " '," | sort >"$privada/lista.txt"
grep -hoiE 'create table (if not exists )?public\.[a-z_]+' "${MIGRACIONES_DE_P02[@]}" | sed -E 's/.*public\.//' | sort >"$privada/tablas.txt"
diff "$privada/lista.txt" "$privada/tablas.txt" || falla "comprobar.sql no lista las mismas tablas que crean las migraciones de P02"
echo "$(wc -l <"$privada/tablas.txt") tablas."

paso "2. respaldo-diario.yml: 04:00 La Paz y 30 días"
grep -qF "cron: '0 8 * * *'" .github/workflows/respaldo-diario.yml || falla "respaldo-diario.yml no corre a las 08:00 UTC"
grep -qF 'retention-days: 30' .github/workflows/respaldo-diario.yml || falla "respaldo-diario.yml no guarda el artefacto 30 días"

paso "3. la base local, desde cero y con solicitudes"
pnpm db:reset

if command -v age >/dev/null && command -v age-keygen >/dev/null; then
  paso "4. respaldar cifrado y restaurar con su pareja (age $(age --version))"
  age-keygen -o "$privada/par1.txt" 2>/dev/null
  age-keygen -o "$privada/par2.txt" 2>/dev/null
  destinatario=$(age-keygen -y "$privada/par1.txt")
  RESPALDO_DESTINATARIO="$destinatario" bash .github/respaldo/respaldar.sh "$privada/respaldo"
  for parte in esquema datos; do
    archivo="$privada/respaldo/$parte.sql.age"
    [ "$(head -c 21 "$archivo")" = 'age-encryption.org/v1' ] || falla "$parte.sql.age no es un archivo de age"
    if grep -aqE 'CREATE TABLE|COPY ' "$archivo"; then falla "$parte.sql.age trae SQL sin cifrar"; fi
  done
  tiene_que_caer "no es la pareja" "restaurar.sh con una identidad que no es la pareja" \
    env RESPALDO_CLAVE="$(cat "$privada/par2.txt")" RESPALDO_DESTINATARIO="$destinatario" \
    bash .github/respaldo/restaurar.sh "$privada/respaldo"
  RESPALDO_CLAVE="$(cat "$privada/par1.txt")" RESPALDO_DESTINATARIO="$destinatario" \
    bash .github/respaldo/restaurar.sh "$privada/respaldo"
elif [ "${CI:-}" = true ]; then
  falla "Falta age en el runner: el cifrado no se puede probar."
else
  paso "4b. sin age: volcar y cargar sin cifrar"
  echo "Sin age: se prueba sin cifrado; el cifrado lo prueba el CI del PR."
  bash .github/respaldo/volcar.sh esquema >"$privada/esquema.sql"
  bash .github/respaldo/volcar.sh datos >"$privada/datos.sql"
  levantar_temporal
  bash .github/respaldo/cargar.sh "$privada/esquema.sql" "$privada/datos.sql"
fi

paso "5. la restauración tiene las tablas de P02 y solicitudes"
bash .github/respaldo/comprobar.sh

paso "6. sin solicitudes, la comprobación cae"
psql_temporal -X -q -v ON_ERROR_STOP=1 -c 'truncate public.solicitudes cascade' >/dev/null
tiene_que_caer "La restauración no trae solicitudes." "comprobar.sh sin solicitudes" bash .github/respaldo/comprobar.sh

paso "7. sin una tabla de P02, la comprobación cae y la nombra"
psql_temporal -X -q -v ON_ERROR_STOP=1 -c 'drop table public.notas cascade' >/dev/null
tiene_que_caer "Faltan tablas de P02 en la restauración: notas." "comprobar.sh sin la tabla notas" \
  bash .github/respaldo/comprobar.sh

paso "Autoprueba de los respaldos: todo en orden."
