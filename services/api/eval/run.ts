/**
 * Eval harness entry point — STUB (ADR-0007 Step 6).
 *
 * This file is a typecheck-clean stub. The full V0 eval harness is
 * implemented in ADR-0007 Step 7 / PR 4.
 *
 * The M1 harness (ADR-0004 Step 9) is retired along with its modes:
 * legacy, planner, new, shadow. The V0 harness will support:
 *   --mode=v0
 *   --mode=out-of-scope-detection
 *   --mode=out-of-scope-false-positive
 *
 * Environment setup: EVAL_MODE=true must be set before any module that reads
 * process.env is imported. This is the very first executable statement per
 * T-0007-169 (source-level assertion in run.test.ts).
 */

// EVAL_MODE must be the first executable statement — T-0007-169.
process.env['EVAL_MODE'] = 'true'
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test'

// ---------------------------------------------------------------------------
// Stub — to be replaced by Step 7 (PR 4).
// ---------------------------------------------------------------------------

console.error(
  'eval harness not yet implemented — ADR-0007 Step 7 (PR 4) will rewrite this file',
)
process.exit(1)

export {}
