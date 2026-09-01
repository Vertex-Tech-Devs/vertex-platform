#!/usr/bin/env bash
#
# deploy-functions.sh — Deploy ultra-rápido y resiliente de Cloud Functions.
#
# Estrategia:
#   1. Intento 1 (Fast-Path): Intenta desplegar TODAS las funciones juntas en 1 sola invocación.
#      Esto tarda ~1.5 - 2 minutos y muestra logs completos en vivo.
#   2. Si GCP responde con error 409 (cola saturada), alterna automáticamente a despliegue
#      por lotes (batch size = 8) con backoff y logs descriptivos en tiempo real.
#

set -uo pipefail

PROJECT="${1:?Uso: deploy-functions.sh <project> [fn1,fn2,...]}"
SPECIFIC="${2:-}"
MAX_ATTEMPTS=8
cd "$(dirname "$0")/.."  # raíz del repo (donde está firebase.json)

TMP_LOG=$(mktemp)
trap 'rm -f "$TMP_LOG"' EXIT

echo "================================================================="
echo "🚀 [$(date +%H:%M:%S)] Iniciando despliegue de Cloud Functions ($PROJECT)..."
echo "================================================================="

if [ -n "$SPECIFIC" ]; then
  TARGET="functions:vertex-platform:$SPECIFIC"
else
  TARGET="functions:vertex-platform"
fi

# INTENTO 1: Fast-Path (Despliegue único masivo)
echo "⚡ Ejecutando despliegue masivo en 1 solo paso (Fast-Path)..."
if npx firebase-tools deploy --only "$TARGET" --project "$PROJECT" --non-interactive --force 2>&1 | tee "$TMP_LOG"; then
  echo ""
  echo "================================================================="
  echo "✅ [$(date +%H:%M:%S)] TODAS las funciones fueron desplegadas con éxito en 1 solo paso!"
  echo "================================================================="
  exit 0
fi

# Fallback a despliegue por lotes si el fast-path no completó al 100%
echo ""
echo "⚠️ [$(date +%H:%M:%S)] Despliegue masivo no completó en 1 solo paso."
echo "🔄 Alternando a estrategia resiliente por lotes para asegurar todas las funciones..."

# FALLBACK: Despliegue por lotes con logs claros y backoff creciente
FUNCS=$(grep -hoE 'export const [a-zA-Z0-9_]+ = (on[A-Za-z]+|runWith)' vertex-platform/functions/src/{admin,provisioning,shards,stores,billing,monitoring,versioning,runtime}.ts 2>/dev/null | awk '{print $3}' | sort -u | tr '\n' ',' | sed 's/,$//')

if [ -z "$FUNCS" ]; then
  echo "No se encontraron funciones en functions/src/index.ts"
  exit 1
fi

IFS=',' read -ra FN_LIST <<< "$FUNCS"
TOTAL_FNS=${#FN_LIST[@]}
BATCH_SIZE=8
FAILED=0
BATCH_NUM=0
TOTAL_BATCHES=$(((TOTAL_FNS + BATCH_SIZE - 1) / BATCH_SIZE))

echo "📦 Desplegando $TOTAL_FNS funciones en $TOTAL_BATCHES lotes (lote = $BATCH_SIZE funciones)..."

deploy_batch() {
  local batch_idx="$1"
  local target_fns="$2"
  local attempt=0
  
  local full=""
  IFS=',' read -ra FNS <<< "$target_fns"
  for fn in "${FNS[@]}"; do
    [ -n "$full" ] && full="$full,"
    full="$full functions:vertex-platform:$fn"
  done

  while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
    attempt=$((attempt + 1))
    echo "-----------------------------------------------------------------"
    echo "▶️ [$(date +%H:%M:%S)] Lote $batch_idx/$TOTAL_BATCHES (Intento $attempt/$MAX_ATTEMPTS): $target_fns"
    echo "-----------------------------------------------------------------"
    
    if npx firebase-tools deploy --only "$full" --project "$PROJECT" --non-interactive --force 2>&1 | tee "$TMP_LOG"; then
      echo "✅ Lote $batch_idx/$TOTAL_BATCHES completado con éxito."
      return 0
    fi
    
    if grep -qE "409|unable to queue" "$TMP_LOG"; then
      local wait=$((30 * attempt))
      echo "⌛ Lote $batch_idx/$TOTAL_BATCHES: Cola saturada (409). Reintentando en ${wait}s..."
      sleep "$wait"
      continue
    fi
    
    echo "❌ ERROR fatal en lote $batch_idx/$TOTAL_BATCHES:"
    cat "$TMP_LOG" | tail -25
    return 1
  done

  echo "💥 ABORTADO Lote $batch_idx/$TOTAL_BATCHES tras $MAX_ATTEMPTS intentos con 409."
  return 1
}

for ((i = 0; i < ${#FN_LIST[@]}; i += BATCH_SIZE)); do
  BATCH_NUM=$((BATCH_NUM + 1))
  BATCH=""
  for ((j = i; j < i + BATCH_SIZE && j < ${#FN_LIST[@]}; j++)); do
    [ -n "$BATCH" ] && BATCH="$BATCH,"
    BATCH="$BATCH${FN_LIST[$j]}"
  done
  
  if ! deploy_batch "$BATCH_NUM" "$BATCH"; then
    FAILED=1
    break
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "================================================================="
  echo "🎉 [$(date +%H:%M:%S)] TODAS las funciones desplegadas correctamente en $PROJECT."
  echo "================================================================="
else
  echo ""
  echo "================================================================="
  echo "❌ [$(date +%H:%M:%S)] Hubo fallos durante el despliegue por lotes en $PROJECT."
  echo "================================================================="
fi

exit $FAILED
