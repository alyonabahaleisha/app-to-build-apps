/**
 * TabBar — two-tab host chrome (Library, Create).
 *
 * ADR-0011 Step 6. Sable's canvas-v0-ux.md §Host Shell.
 *
 * Active tab uses `accent` color; inactive uses `fg-muted`.
 * Root has `accessibilityRole="tablist"`. Each tab has `accessibilityRole="tab"`.
 *
 * Tabs are 44pt minimum touch target (per ARCHITECTURE.md §12).
 *
 * T-0011-124..132, T-0011-139.
 */
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

export type Tab = 'library' | 'create'

interface TabBarProps {
  activeTab: Tab | string
  onPress: (tab: Tab) => void
  onActiveTabPress?: (tab: Tab) => void
}

const TABS: {key: Tab; label: string}[] = [
  {key: 'library', label: 'Library'},
  {key: 'create', label: 'Create'},
]

export function TabBar({activeTab, onPress, onActiveTabPress}: TabBarProps) {
  const theme = useAppShellTheme()

  return (
    <View
      style={[styles.tabBar, {backgroundColor: theme.bg, borderTopColor: theme.divider}]}
      accessibilityRole="tablist"
      testID="tab-bar"
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.key
        const color = isActive ? theme.accent : theme['fg-muted']

        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (isActive) {
                onActiveTabPress?.(tab.key)
              } else {
                onPress(tab.key)
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{selected: isActive}}
            style={styles.tab}
            testID={`tab-${tab.key}`}
          >
            <Text style={[styles.tabLabel, {color}]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
})
