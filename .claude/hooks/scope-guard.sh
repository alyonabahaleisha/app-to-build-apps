#!/usr/bin/env bash
# Scope Guard Hook (pre-tool-use)
# Blocks Edit/Write operations on files outside the plan's files_allowlist.
# Performance-optimized version using cached allowlist instead of jq per call.
#
# Exit codes:
#   0 = allow (file is in scope or no plan active)
#   2 = block (file is outside scope)

set -euo pipefail

INPUT=$(cat)

# Resolve project root (where .claude/ lives) regardless of cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Extract the tool name and file path from the input
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Only guard Edit and Write operations
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "NotebookEdit" ]]; then
  exit 0
fi

# If no file path, allow (shouldn't happen for Edit/Write)
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Fast path: check for cached allowlist written by coordinator
# This avoids scanning state dirs and parsing JSON on every Edit call
ACTIVE_ENV="$PROJECT_ROOT/.claude/.active_ticket_env"
if [[ ! -f "$ACTIVE_ENV" ]]; then
  exit 0  # No active ticket
fi

# Source env to get STATE_DIR
source "$ACTIVE_ENV" 2>/dev/null || exit 0
if [[ -z "${CLAUDE_ACTIVE_STATE_DIR:-}" ]]; then
  exit 0
fi

# Check for cached allowlist
ALLOWLIST="$CLAUDE_ACTIVE_STATE_DIR/.allowlist.txt"
if [[ ! -f "$ALLOWLIST" ]]; then
  exit 0  # No allowlist = no guard (or not in EXECUTING phase yet)
fi

# Normalize the file path (make it relative to project root if absolute)
RELATIVE_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# Always allow writes inside .claude/ — these are state/telemetry/config files
# owned by the coordinator and workers, not source code.
if [[ "$RELATIVE_PATH" == .claude/* ]]; then
  exit 0
fi

# Fast grep check (one subprocess call vs 4 jq calls)
if grep -Fxq "$RELATIVE_PATH" "$ALLOWLIST" 2>/dev/null; then
  exit 0
fi

# Try with src/ prefix
if grep -Fxq "src/$RELATIVE_PATH" "$ALLOWLIST" 2>/dev/null; then
  exit 0
fi

# Try without src/ prefix
STRIPPED_PATH="${RELATIVE_PATH#src/}"
if grep -Fxq "$STRIPPED_PATH" "$ALLOWLIST" 2>/dev/null; then
  exit 0
fi

# Try matching just the basename (for flexibility)
BASENAME=$(basename "$RELATIVE_PATH")
if grep -F "$BASENAME" "$ALLOWLIST" 2>/dev/null | grep -q .; then
  exit 0
fi

# Not found - block the edit
echo "SCOPE GUARD: Blocked edit to '$RELATIVE_PATH' — file is not in plan.json files_allowlist. If you need this file, stop and report that the plan needs updating." >&2
exit 2
