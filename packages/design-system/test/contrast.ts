// WCAG AA contrast ratio helper — test-only utility.
// Not exported from src/ (contrast is build-time validation, not runtime).
//
// Standard WCAG 2.1 relative luminance formula:
//   1. Parse hex to sRGB channels in [0, 1]
//   2. Linearize each channel
//   3. Luminance = 0.2126*R + 0.7152*G + 0.0722*B
//   4. Contrast = (L_lighter + 0.05) / (L_darker + 0.05)

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length !== 6) throw new Error(`Invalid hex color: ${hex}`)
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

function linearize(c: number): number {
  // sRGB linearization per IEC 61966-2-1
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  const R = linearize(r)
  const G = linearize(g)
  const B = linearize(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Returns the WCAG 2.1 contrast ratio between two hex colors.
 * Result is in [1, 21]. WCAG AA requires ≥4.5 for normal text.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const L1 = relativeLuminance(hex1)
  const L2 = relativeLuminance(hex2)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}
