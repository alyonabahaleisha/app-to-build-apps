/**
 * gen-icon-paths.ts — Generates packages/protocol/src/icons/paths.ts
 *
 * Reads ICON_NAMES (the 80-name canonical catalog), looks up each name in
 * lucide-static, and writes a typed ICON_PATHS record to paths.ts.
 *
 * Name mapping: kebab-case → PascalCase (e.g. 'chevron-left' → 'ChevronLeft').
 * lucide-static exports PascalCase full SVG documents.
 *
 * SVG primitive conversion: Lucide uses <path>, <circle>, <line>, <polyline>,
 * and <rect> elements. We convert all primitives to SVG path `d` data strings
 * so ICON_PATHS values satisfy T-0005-230 (canonical SVG path characters only).
 *
 * Fails with a named error if any icon is missing from lucide-static — this is
 * the codegen integrity gate (T-0005-225, T-0005-229).
 *
 * Run via: pnpm --filter @app-creator/protocol codegen
 *      or: pnpm --filter @app-creator/protocol gen-icons
 */
import * as lucide from 'lucide-static'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'packages', 'protocol', 'src', 'icons', 'paths.ts')

// Import ICON_NAMES from the source module (not compiled — tsx handles this)
import {ICON_NAMES} from '../src/icons/names.js'

// ---------------------------------------------------------------------------
// SVG primitive → path `d` conversion helpers
//
// These produce minimal path equivalents that preserve the icon's visual shape.
// Used for icons that Lucide renders with <circle>, <line>, <polyline>, <rect>.
// ---------------------------------------------------------------------------

/** Convert <circle cx="" cy="" r=""> to a path d string */
function circleToPath(cx: number, cy: number, r: number): string {
  // Two-arc approximation of a full circle
  return (
    `M${cx - r},${cy} ` +
    `a${r},${r} 0 1,0 ${r * 2},0 ` +
    `a${r},${r} 0 1,0 ${-r * 2},0`
  )
}

/** Convert <line x1="" y1="" x2="" y2=""> to a path d string */
function lineToPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1} ${y1} L${x2} ${y2}`
}

/** Convert <polyline points="..."> to a path d string.
 * Points are either space-separated (x y x y…) or comma-separated (x,y x,y…).
 */
function polylineToPath(points: string): string {
  // Normalise: replace commas with spaces, collapse whitespace → tokens
  const tokens = points.trim().replace(/,/g, ' ').split(/\s+/)
  const parts: string[] = []
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const cmd = i === 0 ? 'M' : 'L'
    parts.push(`${cmd}${tokens[i]} ${tokens[i + 1]}`)
  }
  return parts.join(' ')
}

/** Convert <rect x="" y="" width="" height="" rx=""> to a path d string */
function rectToPath(x: number, y: number, w: number, h: number, rx: number): string {
  if (rx === 0) {
    return `M${x} ${y} H${x + w} V${y + h} H${x} Z`
  }
  // Rounded rect approximation (simplified cubic bezier)
  const ry = rx
  return (
    `M${x + rx} ${y} ` +
    `H${x + w - rx} ` +
    `Q${x + w} ${y} ${x + w} ${y + ry} ` +
    `V${y + h - ry} ` +
    `Q${x + w} ${y + h} ${x + w - rx} ${y + h} ` +
    `H${x + rx} ` +
    `Q${x} ${y + h} ${x} ${y + h - ry} ` +
    `V${y + ry} ` +
    `Q${x} ${y} ${x + rx} ${y} Z`
  )
}

/** Extract and convert all SVG elements to a single path `d` string */
function svgToPathData(svg: string): string {
  const parts: string[] = []

  // <path d="...">
  for (const m of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
    parts.push(m[1]!)
  }

  // <circle cx="" cy="" r="">
  for (const m of svg.matchAll(/<circle\b[^>]*>/g)) {
    const cx = parseFloat(m[0].match(/\bcx="([^"]+)"/)?.[1] ?? '0')
    const cy = parseFloat(m[0].match(/\bcy="([^"]+)"/)?.[1] ?? '0')
    const r = parseFloat(m[0].match(/\br="([^"]+)"/)?.[1] ?? '0')
    if (!isNaN(cx) && !isNaN(cy) && !isNaN(r)) parts.push(circleToPath(cx, cy, r))
  }

  // <line x1="" y1="" x2="" y2="">
  for (const m of svg.matchAll(/<line\b[^>]*>/g)) {
    const x1 = parseFloat(m[0].match(/\bx1="([^"]+)"/)?.[1] ?? '0')
    const y1 = parseFloat(m[0].match(/\by1="([^"]+)"/)?.[1] ?? '0')
    const x2 = parseFloat(m[0].match(/\bx2="([^"]+)"/)?.[1] ?? '0')
    const y2 = parseFloat(m[0].match(/\by2="([^"]+)"/)?.[1] ?? '0')
    if ([x1, y1, x2, y2].every((n) => !isNaN(n))) parts.push(lineToPath(x1, y1, x2, y2))
  }

  // <polyline points="...">
  for (const m of svg.matchAll(/<polyline\b[^>]*\bpoints="([^"]+)"/g)) {
    parts.push(polylineToPath(m[1]!))
  }

  // <rect width="" height="" x="" y="" rx="">
  for (const m of svg.matchAll(/<rect\b[^>]*>/g)) {
    const w = parseFloat(m[0].match(/\bwidth="([^"]+)"/)?.[1] ?? '0')
    const h = parseFloat(m[0].match(/\bheight="([^"]+)"/)?.[1] ?? '0')
    const x = parseFloat(m[0].match(/\bx="([^"]+)"/)?.[1] ?? '0')
    const y = parseFloat(m[0].match(/\by="([^"]+)"/)?.[1] ?? '0')
    const rx = parseFloat(m[0].match(/\brx="([^"]+)"/)?.[1] ?? '0')
    if ([w, h].every((n) => !isNaN(n))) parts.push(rectToPath(x, y, w, h, rx))
  }

  return parts.join(' ')
}

const paths: Record<string, string> = {}
const missing: string[] = []

for (const name of ICON_NAMES) {
  // kebab-case → PascalCase: 'chevron-left' → 'ChevronLeft'
  const camel = name.replace(/-./g, (m) => m[1]!.toUpperCase())
  const pascal = camel[0]!.toUpperCase() + camel.slice(1)
  const lucideRecord = lucide as Record<string, string>
  if (!(pascal in lucideRecord)) {
    missing.push(`${name} (looked up as ${pascal})`)
    continue
  }
  const pathData = svgToPathData(lucideRecord[pascal]!)
  if (!pathData) {
    missing.push(`${name} (found in lucide-static but yielded no path data)`)
    continue
  }
  paths[name] = pathData
}

if (missing.length > 0) {
  console.error(`gen-icon-paths: missing Lucide icons:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}

const output = [
  '// Generated by gen-icon-paths.ts — do not edit',
  `// lucide-static@0.487.0 · ${ICON_NAMES.length} icons`,
  `import type {IconName} from './names.js'`,
  '',
  `export const ICON_PATHS: Record<IconName, string> = ${JSON.stringify(paths, null, 2)} as const`,
  '',
].join('\n')

fs.writeFileSync(OUTPUT_PATH, output, 'utf8')

process.stdout.write(`[gen-icon-paths] wrote ${OUTPUT_PATH}\n`)
