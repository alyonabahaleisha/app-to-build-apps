/**
 * AccessibilityWrapper — renderer-wide a11y attribute machinery.
 *
 * Wraps any renderer node to apply:
 *   - accessibilityLabel: human-readable name for VoiceOver/TalkBack
 *   - accessibilityRole: semantic role for assistive technology
 *   - accessible={true}: marks the View as an accessibility element
 *
 * Hit-target enforcement (≥44pt minimum touch target per WCAG 2.5.5 and
 * Apple HIG) is applied at the component level in Steps 4+. This wrapper
 * provides the semantic scaffolding; individual components apply minHeight/
 * minWidth styles as appropriate for their interactive surface.
 *
 * Dynamic Type: V0 caps at "Large" accessibility size. Clamping is applied
 * at the typography component level (Steps 4+) via maxFontSizeMultiplier.
 * This wrapper does not clamp — it has no text to clamp.
 */
import React from 'react'
import {View} from 'react-native'
import type {AccessibilityRole} from 'react-native'

// Restrict to the roles meaningful for renderer components in V0.
// A full AccessibilityRole union is too wide and lets callers pass
// nonsense values. This narrows to what the renderer actually uses.
export type RendererAccessibilityRole =
  | 'header'
  | 'button'
  | 'switch'
  | 'image'
  | 'text'
  | 'tab'
  | 'tablist'

export type AccessibilityWrapperProps = {
  children: React.ReactNode
  role?: RendererAccessibilityRole
  label?: string
}

export function AccessibilityWrapper({children, role, label}: AccessibilityWrapperProps) {
  return (
    <View
      accessible={true}
      accessibilityRole={role as AccessibilityRole | undefined}
      accessibilityLabel={label}
    >
      {children}
    </View>
  )
}
