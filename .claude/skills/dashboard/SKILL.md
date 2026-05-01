---
description: "Dashboard and observability skill: reads telemetry, state, and verification data to render human-readable views"
user-invocable: false
---

# Dashboard & Observability Skill

You render observability data from the agentic workflow into human-readable dashboards. You are **read-only** — you never modify state, telemetry, or verification files.

## Data Sources

All data lives under `.claude/state/<ticket-id>/`:

| File | Format | Contents |
|------|--------|----------|
| `state.json` | JSON | Current phase, retry count, config, cost, branch, PR |
| `ticket.json` | JSON | Ticket title, description, AC, source |
| `ac_check.json` | JSON | AC verification verdict and per-criterion results |
| `requirements.md` | Markdown | Grounded requirements |
| `plan.json` | JSON | Execution plan, file scope, steps, test strategy, budget |
| `execution.jsonl` | JSONL | Per-step execution log |
| `verification.json` | JSON | Tiered verification results and final verdict |
| `telemetry.jsonl` | JSONL | Every tool call, phase transition, error event |
| `run_summary.json` | JSON | Final aggregate summary (written at workflow end) |

## Rendering Rules

1. **Use status indicators**: PASS, FAIL, running, pending, skipped, warning
2. **Always show timestamps** in human-friendly format (e.g., "2m 34s ago")
3. **Round costs** to 2 decimal places
4. **Truncate long strings** with `...` to keep dashboards compact

## Metrics to Track

### North Star Metric
**`cost_per_successful_task`** = total tokens for PASS tasks / PASS count

### Operational Metrics
| Metric | Description |
|--------|-------------|
| `phase_duration_ms` | Time spent in each phase |
| `tool_calls_total` | Number of tool invocations |
| `tokens_total` | Total tokens consumed |
| `verdict_total` | Count of each verdict type |
| `retry_count` | Number of retries needed |
| `tier_failure_count` | Failures per verification tier |
| `files_changed` | Files modified in the PR |
