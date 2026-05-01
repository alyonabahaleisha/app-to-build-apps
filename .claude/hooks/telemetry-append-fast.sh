#!/usr/bin/env bash
# Fast Telemetry Hook (post-tool-use)
# Minimal append-only version — no jq on hot path, no glob, no keyword matching.
# Raw hook input gets logged; enrichment happens later during phase transitions.
#
# Performance: ~2 subprocess spawns per call (date, cat) vs ~15-20 in the old version.
# Always exits 0 (telemetry failure should never block execution).

set -uo pipefail

# Resolve project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Fast-path guard: check for active ticket env file
# If not found, exit immediately — no jq parsing, no state scanning.
ACTIVE_ENV="$PROJECT_ROOT/.claude/.active_ticket_env"
if [[ ! -f "$ACTIVE_ENV" ]]; then
  exit 0
fi

# Source the env file to get ticket context
source "$ACTIVE_ENV" 2>/dev/null || exit 0

# Ensure we have the minimum required context
if [[ -z "${CLAUDE_ACTIVE_STATE_DIR:-}" ]]; then
  exit 0
fi

RAW_LOG="$CLAUDE_ACTIVE_STATE_DIR/raw-events.jsonl"
EPOCH_MS=$(($(date +%s%N)/1000000))

# Append raw hook input + timestamp, wrapped as a single line.
# No jq, no parsing, no span tracking — just dump it.
printf '{"epoch_ms":%s,"trace_id":"%s","ticket_id":"%s","phase":"%s","raw":' \
  "$EPOCH_MS" "${CLAUDE_TRACE_ID:-}" "${CLAUDE_TICKET_ID:-}" "${CLAUDE_PHASE:-}" >> "$RAW_LOG"
cat >> "$RAW_LOG"
printf '}\n' >> "$RAW_LOG"

exit 0
