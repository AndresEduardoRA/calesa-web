#!/usr/bin/env bash
# comprobar.sh: corre comprobar.sql en la base temporal (base-temporal.sh). Sale con 0 si la restauración tiene las tablas de P02 y
# solicitudes; si no, con el código de psql y el motivo, que sólo nombra tablas. Lo llaman restauracion-semanal.yml y autoprueba.sh.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/base-temporal.sh"

psql_temporal -X -q -v ON_ERROR_STOP=1 -f - <"$RESPALDOS_DIR/comprobar.sql"
