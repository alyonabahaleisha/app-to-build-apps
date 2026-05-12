/**
 * ShellLayout — host chrome wrapper for Library and Create tabs.
 *
 * ADR-0011 Step 6 + canvas-v0-ux.md §Host Shell.
 *
 * Layout (top → bottom):
 *   - SafeContainer (safe-area insets + theme bg)
 *   - headerSlot (optional — nil renders cleanly, T-0011-141b)
 *   - children
 *   - TabBar (unless hideTabBar=true)
 *
 * VoiceOver focus order: headerSlot → children → TabBar (T-0011-131).
 * Tab navigation is driven by onTabPress; this component does not navigate
 * internally — callers wire their own navigation handlers.
 *
 * T-0011-121..132, T-0011-140, T-0011-141a, T-0011-141b.
 */
import {type ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'

import {TabBar, type Tab} from './TabBar'

interface ShellLayoutProps {
  children: ReactNode
  activeTab: Tab | string
  headerSlot?: ReactNode
  hideTabBar?: boolean
  onTabPress?: (tab: Tab) => void
  onActiveTabPress?: (tab: Tab) => void
}

export function ShellLayout({
  children,
  activeTab,
  headerSlot,
  hideTabBar = false,
  onTabPress,
  onActiveTabPress,
}: ShellLayoutProps) {
  return (
    <SafeContainer>
      <View style={styles.root} testID="shell-layout-root">
        {/* headerSlot — rendered only when provided; null/undefined skip cleanly (T-0011-141b) */}
        {headerSlot ?? null}

        {/* Body content */}
        <View style={styles.body} testID="shell-layout-body">
          {children}
        </View>

        {/* TabBar — omitted when hideTabBar=true (T-0011-123) */}
        {!hideTabBar && (
          <TabBar
            activeTab={activeTab}
            onPress={tab => onTabPress?.(tab)}
            onActiveTabPress={onActiveTabPress}
          />
        )}
      </View>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
})
