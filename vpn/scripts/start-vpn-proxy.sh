#!/usr/bin/env bash
set -euo pipefail

# Starts the vpn-proxy container defined in docker-compose.yml and tails its logs until interrupted.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR%/scripts}"

pushd "$PROJECT_ROOT" >/dev/null

docker compose up -d vpn-proxy

echo "vpn-proxy container started. Press Ctrl+C to stop log tailing."
docker compose logs -f vpn-proxy
