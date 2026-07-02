#!/usr/bin/env bash
set -euo pipefail

cd /workspace/platform

install_if_missing() {
  local package_dir="$1"
  local install_command="$2"
  local label="$3"

  if [[ ! -d "${package_dir}" ]]; then
    echo "Skipping ${label}: ${package_dir} not present."
    return 0
  fi

  # Check if node_modules exists and is NOT empty (to handle initial empty volume mounts).
  # We check if a package-lock.json exists inside node_modules or if the directory has actual files (excluding .bin).
  if [[ -d "${package_dir}/node_modules" ]] && [[ -f "${package_dir}/node_modules/.package-lock.json" || -n "$(ls -A "${package_dir}/node_modules" 2>/dev/null | grep -v '^\.bin$' || true)" ]]; then
    echo "Reusing cached ${label} dependencies."
    return 0
  fi

  echo "Installing ${label} dependencies..."
  (cd "${package_dir}" && eval "${install_command}")

  # If running as root, fix ownership of node_modules to match the parent directory owner to prevent host permission lockout
  if [[ $EUID -eq 0 ]]; then
    local host_uid host_gid
    host_uid=$(stat -c '%u' "${package_dir}")
    host_gid=$(stat -c '%g' "${package_dir}")
    if [[ "${host_uid}" -ne 0 ]]; then
      echo "Fixing ownership for ${label} dependencies to ${host_uid}:${host_gid}..."
      chown -R "${host_uid}:${host_gid}" "${package_dir}/node_modules" 2>/dev/null || true
    fi
  fi
}

# Create relative symlink so storefront can resolve @vertex/contracts locally inside the container
# storefront's package.json references: file:../platform/packages/shared-contracts
# inside the container, storefront is at packages/ecommerce-vertex, so the relative path resolves to packages/platform
mkdir -p packages
ln -sfn .. packages/platform

# Create symlink so scripts in /workspace/platform/scripts can resolve '../../storefront' to storefront
ln -sfn platform/packages/ecommerce-vertex /workspace/storefront


install_if_missing "." "npm ci --legacy-peer-deps --loglevel=error" "root workspace"
install_if_missing "vertex-platform" "npm ci --legacy-peer-deps --loglevel=error" "vertex-platform"
install_if_missing "packages/ecommerce-vertex" "CI=true npm ci --legacy-peer-deps --loglevel=error" "ecommerce-vertex"

exec npm start