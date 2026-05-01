# Telemetry System Migration Guide

This guide explains the refactored telemetry system and how to migrate from the old `telemetry-append.sh` to the new fast version.

## What Changed

### Performance Improvements

**Old system**: `telemetry-append.sh` ran on every tool call, doing ~15-20 subprocess spawns (jq, date, uuidgen, python3, grep chains, filesystem scans).

**New system**: `telemetry-append-fast.sh` runs on every tool call with only ~2 subprocess spawns (date, cat), no jq, no filesystem scanning.

Expected speedup: **5-10x faster per tool call**. On a ticket with 500 tool calls, this saves ~7,500 subprocess spawns.

### Architecture Changes

1. **Fast append-only hook** (`.claude/hooks/telemetry-append-fast.sh`)
   - Writes raw events to `raw-events.jsonl`
   - Gets context from `.claude/.active_ticket_env` (no filesystem scan)
   - No parsing, no span tracking on hot path

2. **Coordinator-driven telemetry** (`.claude/agents/coordinator.md`)
   - Coordinator writes `.claude/.active_ticket_env` when entering phases
   - Coordinator emits `phase_transition` events directly to `telemetry.jsonl`
   - Coordinator removes env file when ticket reaches DONE/ESCALATED

3. **Optional compaction** (`.claude/hooks/telemetry-compact.sh`)
   - Runs once per phase transition (if needed)
   - Enriches raw events with skill/span tracking
   - Truncates raw log after compaction

4. **Scope guard optimization** (`.claude/hooks/scope-guard.sh`)
   - Reads cached `.allowlist.txt` instead of parsing `plan.json` 4 times per Edit
   - Uses grep instead of jq (one subprocess vs 4)
   - Coordinator writes `.allowlist.txt` when entering EXECUTING phase

## Migration Steps

### Step 1: Enable the Fast Hook

Update your `.claude/settings.yml` to use the new hook:

```yaml
hooks:
  post-tool-use: .claude/hooks/telemetry-append-fast.sh
  pre-tool-use: .claude/hooks/scope-guard.sh
```

### Step 2: Verify Coordinator Updates

The coordinator agent (`.claude/agents/coordinator.md`) has been updated to:
- Write `.claude/.active_ticket_env` on phase entry
- Remove it on DONE/ESCALATED
- Emit `phase_transition` events directly
- Write `.allowlist.txt` when entering EXECUTING
- Track `escalated_from_phase` and `escalated_from_tier` on escalations

No manual changes needed - these are in the agent instructions.

### Step 3: (Optional) Enable Compaction

If `raw-events.jsonl` files get large (>1MB), you can enable periodic compaction by having the coordinator call:

```bash
.claude/hooks/telemetry-compact.sh "$STATE_DIR"
```

This is optional because the dashboard reads both `telemetry.jsonl` and can process `raw-events.jsonl` if needed.

### Step 4: Clean Up Old Files

You can optionally archive or remove the old telemetry hook:

```bash
mv .claude/hooks/telemetry-append.sh .claude/hooks/telemetry-append.sh.old
```

## What You Get

### New Dashboard Metrics

The dashboard (`http://localhost:3077/api/metrics`) now includes:

- `retry_rate`: Average retries per ticket
- `verify_retry_loops`: Count of VERIFYING → EXECUTING transitions
- `escalation_sources`: Which phase tickets escalate from (VERIFYING, EXECUTING, etc.)
- `top_files`: Most frequently edited files across all tickets
- `avg_invocations_per_ticket`: How many times each subagent runs per ticket (catches architect's double-run)
- `executor_tools_per_ticket`: Per-ticket breakdown of Read/Edit/Write/Bash/Grep/Glob during EXECUTING

### Questions Now Answered

| Question | Where to Find It |
|----------|-----------------|
| How long does each phase take? | `avg_phase_durations` |
| Where's the bottleneck? | Sort `avg_phase_durations` descending |
| Time-to-success end-to-end? | `avg_time_to_success`, `times_to_success` array |
| Retry rate? | `retry_rate` |
| How often does VERIFYING fail and loop back? | `verify_retry_loops` |
| Which phase do tickets escalate from? | `escalation_sources` |
| Cost per ticket / per success? | `cost_per_success`, `total_tokens` |
| Which subagent takes longest? | `avg_skill_durations` |
| Subagent invocations per ticket? | `avg_invocations_per_ticket` |
| Is architect's double-run expensive? | `avg_invocations_per_ticket.architect` (should show ~2) |
| Read/Edit/Bash counts per executor? | `executor_tools_per_ticket` |
| Which files get touched most? | `top_files` |

## Troubleshooting

### Telemetry not being captured

**Check**: Does `.claude/.active_ticket_env` exist during ticket execution?
- If not, the coordinator isn't writing it. Check coordinator logs.
- The fast hook exits early if this file is missing.

**Check**: Does `raw-events.jsonl` exist in the ticket's state dir?
- If not, the fast hook isn't running. Verify `hooks.post-tool-use` in settings.

### Dashboard shows incomplete data

**Option 1**: The coordinator should be emitting `phase_transition` events directly to `telemetry.jsonl`. Check if these events exist.

**Option 2**: If you have `raw-events.jsonl` but no enriched events, run the compaction script manually:

```bash
.claude/hooks/telemetry-compact.sh .claude/state/<ticket-id>
```

### Scope guard blocking valid edits

**Check**: Does `.allowlist.txt` exist in the ticket's state dir?
- If not, the coordinator didn't write it when entering EXECUTING.
- The scope guard allows all edits if this file is missing.

**Check**: Does the file path match an entry in `.allowlist.txt`?
- The guard tries 4 variants: exact match, with `src/` prefix, without `src/` prefix, basename match.

## Rollback

To revert to the old system:

1. Update `.claude/settings.yml`:
   ```yaml
   hooks:
     post-tool-use: .claude/hooks/telemetry-append.sh.old
   ```

2. The old hook scans for active tickets on disk, so it doesn't depend on `.active_ticket_env`.

3. Remove `.claude/.active_ticket_env` if it exists.
