#!/usr/bin/env bash
#
# deploy-functions.sh — Deploy resiliente de Cloud Functions ante el error
# "409 unable to queue the operation" (cola de operaciones de la región saturada).
#
# Estrategia:
#   1. Despliega en LOTES pequeños (4 funciones) en vez de todas a la vez,
#      reduciendo la concurrencia de operaciones en la región.
#   2. Ante un 409, reintenta con BACKOFF creciente (45s, 90s, 135s, ...)
#      hasta un máximo de intentos, para dejar que la cola se drene sola.
#
# Uso:
#   deploy-functions.sh <project>                # todas las funciones (en lotes)
#   deploy-functions.sh <project> fn1,fn2,fn3    # funciones específicas
#
set -uo pipefail

PROJECT="${1:?Uso: deploy-functions.sh <project> [fn1,fn2,...]}"
SPECIFIC="${2:-}"
MAX_ATTEMPTS=8
cd "$(dirname "$0")/.."  # raíz del repo (donde está firebase.json)

deploy_batch() {
  local target="$1"
  local attempt=0
  # Formato: functions:vertex-platform:fn1,functions:vertex-platform:fn2
  local full=""
  IFS=',' read -ra FNS <<< "$target"
  for fn in "${FNS[@]}"; do
    [ -n "$full" ] && full="$full,"
    full="$full functions:vertex-platform:$fn"
  done
  full="${full# }"
  while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
    attempt=$((attempt + 1))
    echo ">>> [$(date +%H:%M:%S)] Intento $attempt/$MAX_ATTEMPTS: deploy $target"
    OUT=$(npx --yes firebase-tools deploy --only "$full" --project "$PROJECT" --non-interactive --force 2>&1)
    if echo "$OUT" | grep -q "Deploy complete"; then
      echo ">>> OK: $target"
      return 0
    fi
    if echo "$OUT" | grep -qE "409|unable to queue"; then
      local wait=$((45 * attempt))
      echo ">>> 409 (cola saturada). Esperando ${wait}s..."
      sleep "$wait"
      continue
    fi
    echo "$OUT" | tail -25
    echo ">>> ERROR: $target no se pudo desplegar."
    return 1
  done
  echo ">>> ABORTADO tras $MAX_ATTEMPTS intentos con 409: $target"
  return 1
}

if [ -n "$SPECIFIC" ]; then
  deploy_batch "$SPECIFIC"
  exit $?
fi

# Todas las functions exportadas por los módulos de functions/src
FUNCS=$(grep -hoE 'export const [a-zA-Z0-9_]+ = (on[A-Za-z]+|runWith)' vertex-platform/functions/src/{admin,provisioning,shards,stores,billing,monitoring,versioning,runtime}.ts 2>/dev/null | awk '{print $3}' | sort -u | tr '\n' ',' | sed 's/,$//')
if [ -z "$FUNCS" ]; then
  echo "No se encontraron funciones en functions/src/index.ts"
  exit 1
fi
echo "Funciones a desplegar ($(echo "$FUNCS" | tr ',' '\n' | wc -l | tr -d ' ')):"
echo "$FUNCS" | tr ',' '\n' | sed 's/^/  - /'

# Desplegar en lotes de 4
IFS=',' read -ra FN_LIST <<< "$FUNCS"
BATCH_SIZE=4
FAILED=0
for ((i = 0; i < ${#FN_LIST[@]}; i += BATCH_SIZE)); do
  BATCH=""
  for ((j = i; j < i + BATCH_SIZE && j < ${#FN_LIST[@]}; j++)); do
    [ -n "$BATCH" ] && BATCH="$BATCH,"
    BATCH="$BATCH${FN_LIST[$j]}"
  done
  if ! deploy_batch "$BATCH"; then
    FAILED=1
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo "=== TODAS las funciones desplegadas correctamente en $PROJECT ==="
else
  echo "=== ALGUNAS funciones fallaron (revisá los logs) ==="
fi
exit $FAILED
