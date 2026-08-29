#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"
PORT="${PORT:-8000}"

echo "=== Iniciando ITBIS Análisis en http://localhost:${PORT} ==="
python3 -m http.server "$PORT" --directory frontend
