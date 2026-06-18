#!/usr/bin/env bash
# ── Vertex Stack – Docker Start Script ────────────────────────────────────────
# Levanta el stack via Docker y abre el browser cuando todo está listo.
# Requiere: Docker Desktop instalado y corriendo.
#
# Uso:  bash docker/start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       Vertex Stack – Docker Dev      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
  echo "❌  Docker no está corriendo. Abrí Docker Desktop e intentá de nuevo."
  exit 1
fi

# Build + start en background
echo "🔨  Building and starting containers..."
docker compose up -d --build

echo ""
echo "⏳  Waiting for services to be ready..."

wait_for_port() {
  local port=$1
  local name=$2
  local attempts=0
  while ! curl -sf "http://localhost:${port}" > /dev/null 2>&1; do
    sleep 3
    attempts=$((attempts + 1))
    if [ $attempts -ge 40 ]; then
      echo "⚠️  Timeout waiting for ${name} on port ${port}."
      return 1
    fi
  done
  echo "✅  ${name} ready on http://localhost:${port}"
}

wait_for_port 4200 "Platform Admin"
wait_for_port 4201 "Storefront"

echo ""
echo "🚀  Opening browser tabs..."

# Detectar OS para abrir el browser
case "$(uname -s)" in
  Darwin) OPEN_CMD="open" ;;
  Linux)  OPEN_CMD="xdg-open" ;;
  *)      OPEN_CMD="start" ;;
esac

$OPEN_CMD "http://localhost:4200" 2>/dev/null || true
sleep 1
$OPEN_CMD "http://localhost:4201/admin" 2>/dev/null || true
sleep 1
$OPEN_CMD "http://localhost:4201/shop?tenantId=tienda-dos" 2>/dev/null || true

echo ""
echo "────────────────────────────────────────"
echo "  Platform Admin  →  http://localhost:4200"
echo "  Store Admin     →  http://localhost:4201/admin"
echo "  Store Shop      →  http://localhost:4201/shop"
echo "  Emulator UI     →  http://localhost:4000"
echo "────────────────────────────────────────"
echo ""
echo "📋  Streaming logs (Ctrl+C to detach, containers keep running)..."
echo "    To stop everything: docker compose down"
echo ""

docker compose logs -f
