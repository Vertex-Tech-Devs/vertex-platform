#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STOREFRONT_DIR="${ROOT_DIR}/../ecommerce-vertex"

cd "${ROOT_DIR}"

if [[ ! -d "${STOREFRONT_DIR}" ]]; then
  echo "Missing sibling repo: ${STOREFRONT_DIR}"
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  echo "Installing dependencies for vertex-platform"
  npm ci --legacy-peer-deps
fi

if [[ ! -d "${STOREFRONT_DIR}/node_modules" ]]; then
  echo "Installing dependencies for ecommerce-vertex"
  (cd "${STOREFRONT_DIR}" && npm ci)
fi

wait_for_url() {
  local url="$1"
  local label="$2"
  local retries=90

  until curl -sSf "${url}" >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [[ ${retries} -le 0 ]]; then
      echo "Timeout waiting for ${label}: ${url}"
      return 1
    fi
    sleep 2
  done
}

cleanup() {
  if [[ -n "${PLATFORM_PID:-}" ]]; then
    kill "${PLATFORM_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${STOREFRONT_PID:-}" ]]; then
    kill "${STOREFRONT_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm run start -- --host 127.0.0.1 --port 4200 > /tmp/vertex-platform-integration.log 2>&1 &
PLATFORM_PID=$!

cd "${STOREFRONT_DIR}"
npm run start -- --host 127.0.0.1 --port 4201 > /tmp/ecommerce-vertex-integration.log 2>&1 &
STOREFRONT_PID=$!
cd "${ROOT_DIR}"

wait_for_url "http://127.0.0.1:4200" "vertex-platform"
wait_for_url "http://127.0.0.1:4201" "ecommerce-vertex"

npm run test:integration -- --workers=1
