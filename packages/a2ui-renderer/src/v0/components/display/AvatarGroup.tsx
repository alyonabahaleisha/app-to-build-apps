/**
 * AvatarGroupRenderer — stacked avatar row for "N people" affordances.
 *
 * V1 Phase 1 Step 3 (T-0009-076..078, T-0009-086, T-0009-241).
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §AvatarGroup):
 *   - Up to `maxShown` Avatars in a row; each subsequent one overlapping the previous.
 *   - Each avatar wears a 2pt `bg` border (the stacking ring).
 *   - Overflow: a final circle in `bg-elevated` with 1pt `divider` border
 *     showing `+N` in `type-caption`, `fg-muted`, where N = avatars.length - maxShown.
 *   - Overlap:
 *     tight  → -25% diameter (tight stacking)
 *     spread → -10% diameter (slight overlap)
 *
 * Sizes (matching V0 Avatar):
 *   sm → 24pt, md → 32pt, lg → 48pt
 *
 * Stance treatment:
 *   - Productive: sm size default, tight overlap default.
 *   - Expressive: md size default, spread overlap default.
 *
 * Accessibility:
 *   - Wrapper: accessibilityRole="text" (the group is the unit).
 *   - accessibilityLabel auto-generated from avatars + overflow count.
 *   - Format: "5 people: Alex, Sam, Jordan, and 2 others" (T-0009-241)
 *     or "3 people: Alex, Sam, Jordan" when maxShown >= avatars.length.
 *   - Individual avatars: accessibilityElementsHidden (not separately accessible).
 *
 * T-0009-076: renders up to maxShown avatars
 * T-0009-077: renders "+N" overflow when more than maxShown
 * T-0009-078: tight overlap applies -25% width margin
 * T-0009-086: snapshot at productive×focus + expressive×health
 * T-0009-241: auto-generated accessibilityLabel exact format
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'

type AvatarGroupNode = Extract<Node, {type: 'AvatarGroup'}>

const SIZE_TO_DIAMETER = {sm: 24, md: 32, lg: 48} as const

// Overlap fraction of diameter removed as negative right margin.
const OVERLAP_FRACTION = {tight: 0.25, spread: 0.1} as const

function buildA11yLabel(
  avatars: AvatarGroupNode['avatars'],
  maxShown: number,
): string {
  const total = avatars.length
  const shownAvatars = avatars.slice(0, maxShown)
  const overflow = total - maxShown

  const names = shownAvatars.map(a => a.name).join(', ')

  if (overflow <= 0) {
    return `${total} ${total === 1 ? 'person' : 'people'}: ${names}`
  }
  return `${total} people: ${names}, and ${overflow} ${overflow === 1 ? 'other' : 'others'}`
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/[\s'-]+/).filter(Boolean)
  const first = words[0]
  const second = words[1]
  if (words.length === 0 || first === undefined) return '?'
  if (words.length === 1 || second === undefined) {
    return first.slice(0, 2).toUpperCase()
  }
  return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase()
}

export function AvatarGroupRenderer({node}: {node: AvatarGroupNode}) {
  const theme = useTheme()
  const stance = useStance()

  // Stance-driven defaults.
  const defaultSize = stance === 'expressive' ? 'md' : 'sm'
  const defaultOverlap = stance === 'expressive' ? 'spread' : 'tight'

  const size = node.size ?? defaultSize
  const overlap = node.overlap ?? defaultOverlap
  const maxShown = node.maxShown ?? 3

  const diameter = SIZE_TO_DIAMETER[size]
  const fontSize = Math.round(diameter * 0.38)

  const overlapPx = Math.round(diameter * OVERLAP_FRACTION[overlap])
  const overflowCount = node.avatars.length - maxShown

  const shownAvatars = node.avatars.slice(0, maxShown)

  const a11yLabel =
    node.accessibilityLabel ?? buildA11yLabel(node.avatars, maxShown)

  return (
    <View
      style={{flexDirection: 'row', alignItems: 'center'}}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      {shownAvatars.map((avatar, index) => {
        const initials = deriveInitials(avatar.name)
        const marginRight = index < shownAvatars.length - 1 || overflowCount > 0
          ? -overlapPx
          : 0

        return (
          <View
            key={`${avatar.name}-${index}`}
            style={{
              width: diameter,
              height: diameter,
              borderRadius: theme.radii['radius-full'],
              backgroundColor: theme.accent + '26',
              borderWidth: 2,
              borderColor: theme.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight,
              // Stacking order: later avatars render behind earlier ones.
              zIndex: shownAvatars.length - index,
            }}
            accessibilityElementsHidden
          >
            <Text
              style={{
                fontSize,
                fontWeight: '600',
                color: theme.accent,
                lineHeight: diameter - 4, // account for 2pt border on each side
                includeFontPadding: false,
                textAlignVertical: 'center',
              }}
            >
              {initials}
            </Text>
          </View>
        )
      })}

      {/* Overflow indicator: "+N" circle */}
      {overflowCount > 0 ? (
        <View
          style={{
            width: diameter,
            height: diameter,
            borderRadius: theme.radii['radius-full'],
            backgroundColor: theme['bg-elevated'],
            borderWidth: 1,
            borderColor: theme.divider,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
          accessibilityElementsHidden
        >
          <Text
            style={{
              fontSize: theme.type.caption.size,
              fontWeight: '400',
              color: theme['fg-muted'],
              includeFontPadding: false,
            }}
          >
            {`+${overflowCount}`}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
