#!/usr/bin/env bash
# Telemetry Compaction Script
# Reads raw-events.jsonl, enriches with skill/span tracking, appends to telemetry.jsonl.
# Runs once per phase transition (called by coordinator) instead of per tool call.
#
# This is the expensive jq/correlation logic from the old telemetry-append.sh,
# but run in batches instead of on every tool call.

set -uo pipefail

STATE_DIR="${1:?state dir required}"
RAW="$STATE_DIR/raw-events.jsonl"
OUT="$STATE_DIR/telemetry.jsonl"
SPANS="$STATE_DIR/.active_spans.json"

# Exit if no raw events to compact
if [[ ! -s "$RAW" ]]; then
  exit 0
fi

# Initialize span tracker if missing
if [[ ! -f "$SPANS" ]]; then
  echo '{}' > "$SPANS"
fi

# Process raw events in batch
# This is where all the expensive Task/span_start/span_end logic would go
# For now, we'll just convert raw events to tool_call events
while IFS= read -r line; do
  # Extract the raw hook input from the wrapper
  RAW_INPUT=$(echo "$line" | jq -r '.raw // empty' 2>/dev/null || true)
  if [[ -z "$RAW_INPUT" ]]; then
    continue
  fi

  EPOCH_MS=$(echo "$line" | jq -r '.epoch_ms // 0' 2>/dev/null || echo "0")
  TRACE_ID=$(echo "$line" | jq -r '.trace_id // empty' 2>/dev/null || true)
  TICKET_ID=$(echo "$line" | jq -r '.ticket_id // empty' 2>/dev/null || true)
  PHASE=$(echo "$line" | jq -r '.phase // empty' 2>/dev/null || true)

  # Extract tool info
  TOOL_NAME=$(echo "$RAW_INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")

  TOOL_SUCCESS_RAW=$(echo "$RAW_INPUT" | jq -r '.tool_response.success // empty' 2>/dev/null || true)
  if [[ "$TOOL_SUCCESS_RAW" == "false" ]]; then
    TOOL_SUCCESS="false"
  else
    TOOL_SUCCESS="true"
  fi

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  SPAN_ID=$(uuidgen 2>/dev/null || echo "span-$(date +%s)-$$")

  # Extract tool-specific context
  TOOL_FILE=""
  TOOL_COMMAND_SNIPPET=""
  SKILL_NAME=""
  SUBAGENT_TYPE=""
  TASK_DESCRIPTION=""

  case "$TOOL_NAME" in
    Edit|Write|NotebookEdit)
      TOOL_FILE=$(echo "$RAW_INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null || true)
      ;;
    Read)
      TOOL_FILE=$(echo "$RAW_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
      ;;
    Glob)
      TOOL_FILE=$(echo "$RAW_INPUT" | jq -r '.tool_input.pattern // empty' 2>/dev/null || true)
      ;;
    Grep)
      TOOL_FILE=$(echo "$RAW_INPUT" | jq -r '.tool_input.pattern // empty' 2>/dev/null || true)
      ;;
    Bash)
      TOOL_COMMAND_SNIPPET=$(echo "$RAW_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null | head -c 120 || true)
      ;;
    Task)
      SUBAGENT_TYPE=$(echo "$RAW_INPUT" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null || true)
      TASK_DESCRIPTION=$(echo "$RAW_INPUT" | jq -r '.tool_input.description // empty' 2>/dev/null || true)
      SKILL_NAME="$SUBAGENT_TYPE"
      ;;
    Skill)
      SKILL_NAME=$(echo "$RAW_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
      ;;
  esac

  # Compute duration from last event
  DURATION_MS=0
  if [[ -f "$OUT" ]]; then
    LAST_EPOCH=$(tail -1 "$OUT" 2>/dev/null | jq -r '.epoch_ms // empty' 2>/dev/null || true)
    if [[ -n "$LAST_EPOCH" && "$LAST_EPOCH" != "0" && "$EPOCH_MS" != "0" ]]; then
      DURATION_MS=$(( EPOCH_MS - LAST_EPOCH ))
      if [[ "$DURATION_MS" -lt 0 || "$DURATION_MS" -gt 1800000 ]]; then
        DURATION_MS=0
      fi
    fi
  fi

  # Handle Task/Skill span tracking
  if [[ "$TOOL_NAME" == "Task" || "$TOOL_NAME" == "Skill" ]] && [[ -n "$SKILL_NAME" ]]; then
    EFFECTIVE_SKILL="${SKILL_NAME:-unknown}"

    ACTIVE_SPAN_ID=""
    SPAN_START_EPOCH="0"
    if [[ -f "$SPANS" ]]; then
      ACTIVE_SPAN_ID=$(jq -r --arg skill "$EFFECTIVE_SKILL" '.[$skill].span_id // empty' "$SPANS" 2>/dev/null || true)
      SPAN_START_EPOCH=$(jq -r --arg skill "$EFFECTIVE_SKILL" '.[$skill].epoch_ms // "0"' "$SPANS" 2>/dev/null || true)
    fi

    if [[ -n "$ACTIVE_SPAN_ID" ]]; then
      # span_end
      SPAN_DURATION=0
      if [[ "$SPAN_START_EPOCH" != "0" && "$EPOCH_MS" != "0" ]]; then
        SPAN_DURATION=$(( EPOCH_MS - SPAN_START_EPOCH ))
      fi

      jq -n \
        --arg ts "$TIMESTAMP" \
        --arg trace "$TRACE_ID" \
        --arg span "$ACTIVE_SPAN_ID" \
        --arg ticket "$TICKET_ID" \
        --arg phase "$PHASE" \
        --arg skill "$EFFECTIVE_SKILL" \
        --arg subtype "${SUBAGENT_TYPE:-}" \
        --argjson success "$TOOL_SUCCESS" \
        --argjson duration "$SPAN_DURATION" \
        --argjson epoch "$EPOCH_MS" \
        '{
          timestamp: $ts,
          trace_id: $trace,
          span_id: $span,
          ticket_id: $ticket,
          phase: $phase,
          event_type: "span_end",
          epoch_ms: $epoch,
          attributes: {
            operation: ("skill:" + $skill),
            skill: $skill,
            subagent_type: $subtype,
            result: (if $success then "pass" else "fail" end),
            duration_ms: $duration,
            success: $success
          }
        }' >> "$OUT" 2>/dev/null || true

      jq --arg skill "$EFFECTIVE_SKILL" 'del(.[$skill])' "$SPANS" > "$SPANS.tmp" 2>/dev/null && \
        mv "$SPANS.tmp" "$SPANS" 2>/dev/null || true
    else
      # span_start
      jq -n \
        --arg ts "$TIMESTAMP" \
        --arg trace "$TRACE_ID" \
        --arg span "$SPAN_ID" \
        --arg ticket "$TICKET_ID" \
        --arg phase "$PHASE" \
        --arg skill "$EFFECTIVE_SKILL" \
        --arg subtype "${SUBAGENT_TYPE:-}" \
        --arg desc "${TASK_DESCRIPTION:-}" \
        --argjson epoch "$EPOCH_MS" \
        '{
          timestamp: $ts,
          trace_id: $trace,
          span_id: $span,
          ticket_id: $ticket,
          phase: $phase,
          event_type: "span_start",
          epoch_ms: $epoch,
          attributes: {
            operation: ("skill:" + $skill),
            skill: $skill,
            subagent_type: $subtype,
            description: $desc
          }
        }' >> "$OUT" 2>/dev/null || true

      jq --arg skill "$EFFECTIVE_SKILL" --arg span "$SPAN_ID" --argjson epoch "$EPOCH_MS" \
        '.[$skill] = {"span_id": $span, "epoch_ms": $epoch}' \
        "$SPANS" > "$SPANS.tmp" 2>/dev/null && \
        mv "$SPANS.tmp" "$SPANS" 2>/dev/null || true
    fi
  fi

  # Emit tool_call event
  ATTR_JSON=$(jq -n \
    --arg tool "$TOOL_NAME" \
    --argjson success "$TOOL_SUCCESS" \
    --argjson duration "$DURATION_MS" \
    --arg file "${TOOL_FILE:-}" \
    --arg command "${TOOL_COMMAND_SNIPPET:-}" \
    --arg skill "${SKILL_NAME:-}" \
    --arg subtype "${SUBAGENT_TYPE:-}" \
    --arg desc "${TASK_DESCRIPTION:-}" \
    '{
      tool: $tool,
      success: $success,
      duration_ms: $duration
    }
    + (if $file != "" then {file: $file} else {} end)
    + (if $command != "" then {command_snippet: $command} else {} end)
    + (if $skill != "" then {skill: $skill} else {} end)
    + (if $subtype != "" then {subagent_type: $subtype} else {} end)
    + (if $desc != "" then {description: $desc} else {} end)
  ' 2>/dev/null || echo '{"tool":"'"$TOOL_NAME"'","success":'"$TOOL_SUCCESS"'}')

  jq -n \
    --arg ts "$TIMESTAMP" \
    --arg trace "$TRACE_ID" \
    --arg span "$SPAN_ID" \
    --arg ticket "$TICKET_ID" \
    --arg phase "$PHASE" \
    --argjson epoch "$EPOCH_MS" \
    --argjson attrs "$ATTR_JSON" \
    '{
      timestamp: $ts,
      trace_id: $trace,
      span_id: $span,
      ticket_id: $ticket,
      phase: $phase,
      event_type: "tool_call",
      epoch_ms: $epoch,
      attributes: $attrs
    }' >> "$OUT" 2>/dev/null || true

done < "$RAW"

# Truncate raw log after successful compaction
: > "$RAW"

exit 0
