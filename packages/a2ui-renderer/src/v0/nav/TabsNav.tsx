/**
 * TabsNav — segmented-control navigation for specs with navigation: 'tabs'.
 *
 * Per UX doc §Pattern 3: tabs:
 *   36pt tall segmented control 12pt below host header.
 *   Up to 4 tabs (schema-enforced; 5+ rejected at parse).
 *   Active tab: accent underline + accent text; inactive: fg-muted.
 *   Crossfade between tab content, 200ms motion-smooth.
 *
 * Tab labels come from screen.title ?? screen.id.
 *
 * The `navigate` dispatch on a tabs spec switches to the target tab index.
 * The `back` action on tabs has no history stack (we don't push history for
 * tab switches) — middleware passes back → reducer no-ops (history empty)
 * → onNavigationError('back-on-empty-history').
 *
 * This navigator does NOT use React Navigation — it's a custom segmented
 * control (pure RN) to avoid the bottom tab bar. Host owns bottom tabs.
 *
 * NavigationPrimitive provided to onPrimitiveReady:
 *   navigate(screenId) → switch to that screen's tab index.
 *   pop() → no-op (no history in tabs; back-on-empty-history fires first in middleware).
 *
 * T-0006-166: mounts TabsNav with segmented control
 * T-0006-167: tab selection swaps body content
 * T-0006-168: 5 screens rejected at schema parse (handled by Zod + validateCrossRefs)
 */
import React, {useState, useRef, useEffect} from 'react'
import {View, Text, Pressable} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import type {Spec} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation.js'
import {useTheme} from '../theme/RendererThemeProvider.js'
import {NodeRenderer} from '../components/NodeRenderer.js'

export type TabsNavProps = {
  spec: Spec
  onPrimitiveReady: (primitive: NavigationPrimitive | null) => void
}

const TAB_BAR_HEIGHT = 36
const TAB_BAR_MARGIN_TOP = 12

export function TabsNav({spec, onPrimitiveReady}: TabsNavProps) {
  const theme = useTheme()
  const [activeIndex, setActiveIndex] = useState(0)
  // Stable ref so the primitive closure captures the setter without stale closure.
  const setActiveIndexRef = useRef(setActiveIndex)
  setActiveIndexRef.current = setActiveIndex

  // Register the navigation primitive on mount.
  useEffect(() => {
    const primitive: NavigationPrimitive = {
      navigate(screenId: string) {
        const idx = spec.screens.findIndex(s => s.id === screenId)
        if (idx >= 0) {
          setActiveIndexRef.current(idx)
        }
      },
      pop() {
        // Tabs have no history stack. The navigation middleware fires
        // back-on-empty-history before calling pop() when history is empty.
        // No imperative action needed here.
      },
    }
    onPrimitiveReady(primitive)
    return () => {
      onPrimitiveReady(null)
    }
  }, [spec, onPrimitiveReady])

  const activeScreen = spec.screens[activeIndex]

  return (
    <View style={{flex: 1}}>
      {/* Segmented control — 36pt tall, 12pt below host header */}
      <View
        style={{
          height: TAB_BAR_HEIGHT,
          marginTop: TAB_BAR_MARGIN_TOP,
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: theme.divider,
          backgroundColor: theme.bg,
        }}
        accessibilityRole="tablist"
      >
        {spec.screens.map((screen, idx) => {
          const isActive = idx === activeIndex
          const label = screen.title ?? screen.id
          return (
            <Pressable
              key={screen.id}
              onPress={() => setActiveIndex(idx)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 8,
                borderBottomWidth: isActive ? 2 : 0,
                borderBottomColor: isActive ? theme.accent : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{selected: isActive}}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? theme.accent : theme['fg-muted'],
                }}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content — crossfade 200ms */}
      {activeScreen && (
        <Animated.View
          key={activeScreen.id}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{flex: 1}}
        >
          <NodeRenderer node={activeScreen.root} />
        </Animated.View>
      )}
    </View>
  )
}
