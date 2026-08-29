#!/usr/bin/env bash
set -e

echo "=== Instalando dependencias ==="
cd "$(dirname "$0")/backend"
pip install -r requirements.txt -q

echo ""
echo "=== Iniciando servidor en http://localhost:5000 ==="
python app.py
