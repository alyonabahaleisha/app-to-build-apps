#!/usr/bin/env bash
# Run Summary Hook (stop)
# When Claude finishes, check if there's an active ticket execution
# and log the interruption if the workflow is incomplete.

set -uo pipefail

INPUT=$(cat)

# Resolve project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Find active state directory
STATE_DIR=""
TICKET_ID=""
PHASE=""

for state_file in "$PROJECT_ROOT"/.claude/state/*/state.json; do
  if [[ -f "$state_file" ]]; then
    CURRENT_PHASE=$(jq -r '.phase // empty' "$state_file" 2>/dev/null || true)
    if [[ -n "$CURRENT_PHASE" && "$CURRENT_PHASE" != "DONE" && "$CURRENT_PHASE" != "ESCALATED" ]]; then
      STATE_DIR=$(dirname "$state_file")
      TICKET_ID=$(jq -r '.ticket_id // empty' "$state_file" 2>/dev/null || true)
      PHASE="$CURRENT_PHASE"
      break
    fi
  fi
done

# If no active (incomplete) execution, allow stop
if [[ -z "$STATE_DIR" ]]; then
  echo '{"ok": true}'
  exit 0
fi

# If execution is in progress, warn but allow stop (state is saved for resume)
if [[ "$PHASE" == "EXECUTING" || "$PHASE" == "VERIFYING" || "$PHASE" == "PLANNING" ]]; then
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  jq --arg ts "$TIMESTAMP" '.updated_at = $ts' "$STATE_DIR/state.json" > "$STATE_DIR/state.json.tmp" 2>/dev/null && \
    mv "$STATE_DIR/state.json.tmp" "$STATE_DIR/state.json" 2>/dev/null || true

  # Append stop event to telemetry
  TRACE_ID=$(jq -r '.trace_id // ""' "$STATE_DIR/state.json" 2>/dev/null || true)
  TELEMETRY_FILE="$STATE_DIR/telemetry.jsonl"
  jq -n \
    --arg ts "$TIMESTAMP" \
    --arg trace "$TRACE_ID" \
    --arg ticket "$TICKET_ID" \
    --arg phase "$PHASE" \
    '{
      timestamp: $ts,
      trace_id: $trace,
      ticket_id: $ticket,
      phase: $phase,
      event_type: "workflow_interrupted",
      attributes: {
        reason: "claude_stopped",
        resumable: true
      }
    }' >> "$TELEMETRY_FILE" 2>/dev/null || true

  echo '{"ok": true}'
  exit 0
fi

echo '{"ok": true}'
exit 0
