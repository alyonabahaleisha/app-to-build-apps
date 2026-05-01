---
description: "Observability and telemetry skill: structured logging, trace correlation, metrics"
user-invocable: false
---

# Observability & Telemetry Skill

Provides structured logging and trace correlation for the agentic workflow. All telemetry is file-based (no external services required).

## Telemetry File

All telemetry is appended to `.claude/state/<ticket-id>/telemetry.jsonl` as newline-delimited JSON.

## Event Schema

Every telemetry event has these common fields:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "trace_id": "<root-trace-id>",
  "span_id": "<unique-span-id>",
  "parent_span_id": "<parent-span-id-or-null>",
  "ticket_id": "<ticket-id>",
  "agent_name": "coordinator|product-owner|designer|architect|rn-executor|qa|ticket-manager",
  "phase": "INTAKE|AC_VERIFY|REQUIREMENTS|PLANNING|EXECUTING|VERIFYING|MERGING",
  "event_type": "span_start|span_end|phase_transition|metric|error|tool_call",
  "epoch_ms": 1234567890123,
  "attributes": {}
}
```

## Event Types

### Phase Transition
```json
{
  "event_type": "phase_transition",
  "attributes": {
    "from_phase": "PLANNING",
    "to_phase": "EXECUTING",
    "reason": "plan approved",
    "duration_ms": 45000
  }
}
```

### Span Start/End
```json
{
  "event_type": "span_start",
  "span_id": "verify-tier1-001",
  "attributes": { "operation": "verify_tier1_build", "tier": 1 }
}
```

### Tool Call
```json
{
  "event_type": "tool_call",
  "attributes": {
    "tool": "Edit",
    "file": "src/screens/ProfileScreen/index.tsx",
    "duration_ms": 50,
    "success": true
  }
}
```

### Error
```json
{
  "event_type": "error",
  "attributes": {
    "error_type": "typecheck_failure",
    "message": "Cannot find name 'ProfileData'",
    "file": "src/screens/ProfileScreen/index.tsx",
    "line": 42,
    "recoverable": true
  }
}
```

## Run Summary

At workflow end, write `.claude/state/<ticket-id>/run_summary.json`:

```json
{
  "ticket_id": "<ticket-id>",
  "trace_id": "<trace-id>",
  "verdict": "PASS|FAIL_RETRY|FAIL_ESCALATE",
  "started_at": "...",
  "completed_at": "...",
  "total_duration_ms": 0,
  "phases_completed": ["INTAKE", "AC_VERIFY", "..."],
  "retry_count": 0,
  "cost": {
    "total_tokens": 0,
    "total_tool_calls": 0,
    "estimated_cost_usd": 0.0
  },
  "verification_summary": {
    "tier1_build_lint": "pass",
    "tier2_unit_tests": "pass",
    "tier3_e2e_tests": "pass|skipped",
    "tier4_smoke": "pass|skipped"
  },
  "pr_url": "https://github.com/...",
  "files_changed": 5,
  "lines_added": 200,
  "lines_removed": 50
}
```
