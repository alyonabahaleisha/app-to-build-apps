/**
 * scripts/index.ts — Codegen orchestrator
 *
 * Runs all 3 codegen scripts in sequence. Used by the `codegen` package script:
 *   pnpm --filter @app-creator/protocol codegen
 *
 * Output artifacts:
 *   packages/protocol/generated/json-schema.json — LLM tool input_schema
 *   packages/protocol/generated/types.ts          — TypeScript types
 *   packages/protocol/generated/docs.md           — Prompt catalog block
 *
 * CI guard: .github/workflows/codegen-drift.yml runs this, then
 * `git diff --exit-code packages/protocol/generated/` to detect drift.
 */
import {fileURLToPath} from 'node:url'
import * as path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.stdout.write('[codegen] starting protocol codegen...\n')

// Dynamic imports run each script in sequence. We use dynamic import so each
// script's top-level side effect (fs.writeFileSync) runs in order.
//
// Order matters: gen-icon-paths.ts must run first because it writes
// src/icons/paths.ts, which is imported by spec.zod.ts via slot.ts →
// IconNameSchema. gen-json-schema.ts then captures the 80-value enum.
await import(path.join(__dirname, 'gen-icon-paths.js'))
await import(path.join(__dirname, 'gen-json-schema.js'))
await import(path.join(__dirname, 'gen-types.js'))
await import(path.join(__dirname, 'gen-docs.js'))

process.stdout.write('[codegen] done — 4 files written\n')
