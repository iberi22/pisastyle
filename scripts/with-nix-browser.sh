#!/usr/bin/env bash
# Ejecuta un comando con un Chromium que arranca en este NixOS.
#
# POR QUE EXISTE ESTE SCRIPT
# El Chromium que trae Playwright (~/.cache/ms-playwright) es un binario
# generico de Linux y en NixOS le faltan ~21 bibliotecas: libnspr4, libnss3,
# libglib-2.0, libatk-1.0, libX11, libgbm, libasound, libatspi, ... Se
# comprueba con:
#
#   ldd ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | grep -c 'not found'
#
# Anadir directorios del store a LD_LIBRARY_PATH lo va tapando (21 -> 9) pero
# no lo cierra del todo y, ademas, hay que acertar el hash de cada derivacion:
# el hash cambia entre generaciones de NixOS y el script se rompe solo.
#
# LA VIA QUE SI FUNCIONA: usar el Chromium DEL NIX, que ya trae sus propias
# dependencias, y decirl a Playwright que lo ejecute con `executablePath`.
# Esta verificado en esta maquina: arranca, navega y hace screenshot.
#
# USO
#   scripts/with-nix-browser.sh <comando...>
#
# Exporta dos variables para que el comando las vea:
#   PISASYLE_BROWSER_PATH  ruta al binario de chromium a usar
#   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH  lo mismo, con el nombre que
#                         espera Playwright por convenience
set -euo pipefail

# 1) Preferir el Chromium del perfil del usuario si ya esta ahi.
CHROME=""
for cand in \
  "$(command -v chromium 2>/dev/null || true)" \
  "$(command -v chromium-browser 2>/dev/null || true)" \
  "$(command -v google-chrome 2>/dev/null || true)"; do
  if [ -n "$cand" ] && [ -x "$cand" ]; then
    # solo vale si arranca de verdad
    if "$cand" --version >/dev/null 2>&1; then CHROME="$cand"; break; fi
  fi
done

# 2) Si no, buscar el binario del chromium de nixpkgs mas reciente.
if [ -z "$CHROME" ]; then
  CHROME="$(ls -t /nix/store/*-chromium-*/bin/chromium 2>/dev/null | head -1 || true)"
fi

# 3) Y si tampoco, el headless shell de Playwright como ultimo recurso
#    (funcionara solo si el host tiene las libs del sistema).
if [ -z "$CHROME" ]; then
  CHROME="$(ls -t "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | head -1 || true)"
fi

if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  echo "with-nix-browser: no se encontro ningun Chromium utilizable" >&2
  exit 1
fi

export PISASYLE_BROWSER_PATH="$CHROME"
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROME"
# Sin esto Chromium aborta como root en varios entornos.
export NODE_OPTIONS="${NODE_OPTIONS:-}"

exec "$@"