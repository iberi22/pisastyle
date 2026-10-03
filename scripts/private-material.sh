#!/usr/bin/env bash
# Mueve el material PRIVADO de PISAStyle fuera del root del proyecto.
#
# POR QUE — hallazgo verificado 2026-10-03 (no es teoria):
# `astro dev` sirve por HTTP cualquier archivo del project root, no solo los
# de src/. Comprobado en runtime contra el dev server:
#   GET /docs/PISASTYLE_PLAN_2H.md                 -> 200 text/markdown (plan interno)
#   GET /pisa_units/math/PISA-MAT-001-mosaico-solar.md -> 200 (unidad + rubrica)
#   GET /backend_adapters/validate_pisa.js          -> 200
#   GET /src/data/sample-unit.pt.json               -> 200 (answer key)
# Mover el archivo fuera del root -> 404 inmediato. Verificado.
#
# .gitignore NO protege de esto: el archivo sigue en disco, solo que sin
# trackear. Y `vite.server.fs.deny` NO sirve: Astro 7 solo lo aplica a la
# carga de imagenes (node_modules/astro/dist/assets/endpoint/dev.js), no al
# middleware de archivos estaticos. Se comprobo leyendo el codigo.
#
# ALCANCE REAL: el build de produccion esta limpio. `grep` sobre dist/ da 0
# coincidencias de PISASTYLE_PLAN_2H, sample-unit, mosaico-solar y
# validate_pisa. Esto aplica al DEV SERVER, que es un riesgo real en
# Codespaces / dev server en red / docker -p, no a produccion.
#
# USO:  ./scripts/private-material.sh stash    # mover fuera (sesion normal)
#       ./scripts/private-material.sh restore  # traer de vuelta
#       ./scripts/private-material.sh status   # ver donde esta cada cosa
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="${PISA_PRIVATE_VAULT:-$HOME/proyectosSWAL/.private/pisastyle}"

# Materiales privados, relativos al root. Deben seguir .gitignore'd tambien:
# el vault esta fuera del repo, pero alguien podria moverlo de vuelta.
ITEMS=(
  "docs/PISASTYLE_PLAN_2H.md"
  "pisa_units"
  "study_content"
  "answer_keys"
  "content_packs"
  "backend_adapters"
  "telemetry_raw"
  # Los mocks de src/data/ son contenido privado con rubrica (LICENSE.md
  # punto 2), pero viven en src/ y el dev server tambien los sirve por HTTP.
  # Moverlos rompe cualquier import estatico que los use; hoy ninguno los
  # importa, y la app cae al catalogo de novedades/faq en su lugar.
  "src/data/sample-unit.pt.json"
  "src/data/sample-science-en.json"
  "src/data/sample-math-en.json"
  "src/data/sample-math-pt.json"
  "src/data/sample-reading-es.json"
  "src/data/sample-reading-pt.json"
)

cmd="${1:-status}"

stash_one() {
  local rel="$1" src="$ROOT/$1" dst="$VAULT/$1"
  [ -e "$src" ] || return 0
  mkdir -p "$(dirname "$dst")"
  mv "$src" "$dst"
  echo "  movido  $rel"
}

restore_one() {
  local rel="$1" src="$VAULT/$1" dst="$ROOT/$1"
  [ -e "$src" ] || return 0
  mkdir -p "$(dirname "$dst")"
  mv "$src" "$dst"
  echo "  devuelto $rel"
}

case "$cmd" in
  stash)
    echo "PISAStyle — material privado -> $VAULT"
    for i in "${ITEMS[@]}"; do stash_one "$i"; done
    echo "Hecho. El dev server ya no lo sirve (404). Para editarlo, 'restore' primero."
    ;;
  restore)
    echo "PISAStyle — material privado <- $VAULT"
    for i in "${ITEMS[@]}"; do restore_one "$i"; done
    echo "Hecho. Recuerda: con esto dentro del root, 'astro dev' lo sirve por HTTP."
    ;;
  status)
    printf '%-34s %-10s %s\n' RUTA EN-ROOT VAULT
    for i in "${ITEMS[@]}"; do
      inroot="no"; vault="no"
      [ -e "$ROOT/$i" ] && inroot="SI  <-- se sirve por HTTP"
      [ -e "$VAULT/$i" ] && vault="si"
      printf '%-34s %-22s %s\n' "$i" "$inroot" "$vault"
    done
    ;;
  *)
    echo "uso: $0 {stash|restore|status}" >&2
    exit 2
    ;;
esac