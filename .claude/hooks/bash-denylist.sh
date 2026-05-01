#!/usr/bin/env bash
# Bash Denylist Hook (pre-tool-use)
# Blocks dangerous bash commands during ticket execution.
#
# Exit codes:
#   0 = allow
#   2 = block

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only guard Bash tool
if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# Resolve project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check for any active ticket execution
ACTIVE_EXECUTION=false
for state_file in "$PROJECT_ROOT"/.claude/state/*/state.json; do
  if [[ -f "$state_file" ]]; then
    PHASE=$(jq -r '.phase // empty' "$state_file" 2>/dev/null || true)
    if [[ "$PHASE" == "EXECUTING" || "$PHASE" == "VERIFYING" ]]; then
      ACTIVE_EXECUTION=true
      break
    fi
  fi
done

# Only enforce during active ticket execution
if [[ "$ACTIVE_EXECUTION" != "true" ]]; then
  exit 0
fi

# Denylist patterns
BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git push --force"
  "git push -f"
  "git reset --hard"
  "git clean -fd"
  "git branch -D"
  "git rebase -i"
  "sudo "
  "chmod 777"
  "curl.*| sh"
  "curl.*| bash"
  "wget.*| sh"
  "wget.*| bash"
  ":(){:|:&};:"
  "mkfs\."
  "dd if="
  ">/dev/sda"
  "npm publish"
  "yarn publish"
  "expo publish"
  "eas submit"
  "eas build.*--auto-submit"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo "BASH DENYLIST: Blocked dangerous command matching pattern '$pattern'. This command is not allowed during automated ticket execution." >&2
    exit 2
  fi
done

exit 0
