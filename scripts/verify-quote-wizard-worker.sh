#!/usr/bin/env bash
set -euo pipefail

WORKER_URL="${1:-${QUOTE_WIZARD_WORKER_URL:-}}"

if [[ -z "$WORKER_URL" ]]; then
  echo "Usage: $0 https://<worker-host>" >&2
  echo "Or set QUOTE_WIZARD_WORKER_URL=https://<worker-host>/analyze" >&2
  exit 1
fi

BASE_URL="${WORKER_URL%/analyze}"
BASE_URL="${BASE_URL%/}"

echo "Checking ${BASE_URL}/health"
curl -fsS "${BASE_URL}/health"
echo
