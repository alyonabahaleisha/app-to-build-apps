/**
 * gen-json-schema.ts — Generates packages/protocol/generated/json-schema.json
 *
 * The output is the LLM tool input_schema for `produce_app_spec`. ADR-0007
 * imports it. This file is the source of truth; never hand-edit the output.
 *
 * Output contract:
 *   - JSON Schema 7 format (zod-to-json-schema `target: 'jsonSchema7'`)
 *   - Deterministic: same input always produces the same bytes
 *   - Does NOT contain "share" anywhere (F-02 / T-0005-187a guard)
 *   - Action verb discriminated union has exactly 12 members (F-13 / T-0005-187b)
 *
 * Run via: pnpm --filter @app-creator/protocol codegen
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'
import {zodToJsonSchema} from 'zod-to-json-schema'

// ESM-safe __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'packages', 'protocol', 'generated', 'json-schema.json')

// Import AFTER path setup — this is the source of truth
import {SpecSchema} from '../src/spec.zod.js'

const json = zodToJsonSchema(SpecSchema, {target: 'jsonSchema7', name: 'Spec'})
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json, null, 2) + '\n', 'utf8')

process.stdout.write(`[gen-json-schema] wrote ${OUTPUT_PATH}\n`)
