#!/usr/bin/env bash
# scripts/check-public-tree.sh — Puerta del arbol publico. Implementacion en
# scripts/check-public-tree.mjs (ver alli la cabecera completa).
#
# Comprueba que el repo publico no lleva ids de infra reales, ficheros que no
# deberian estar trackeados, cadenas prohibidas ni secretos (gitleaks).
#
# Uso:
#   bash scripts/check-public-tree.sh
#   ENFORCE_SECRET_SCAN=1 bash scripts/check-public-tree.sh   # CI: gitleaks obligatorio
#
# Exit: 0 limpio, 1 hallazgos, 2 no se pudo ejecutar (gitleaks exigido y ausente).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/check-public-tree.mjs "$@"
