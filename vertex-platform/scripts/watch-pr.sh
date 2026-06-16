#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/watch-pr.sh <pr-number> [interval-seconds]" >&2
  exit 1
fi

pr_number="$1"
interval="${2:-300}"

if ! [[ "$interval" =~ ^[0-9]+$ ]]; then
  echo "Interval must be an integer number of seconds" >&2
  exit 1
fi

echo "Watching PR #$pr_number every $interval seconds..."
exec gh pr checks "$pr_number" --watch --interval "$interval"
