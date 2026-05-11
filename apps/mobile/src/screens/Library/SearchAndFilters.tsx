/**
 * SearchAndFilters — sticky search field + filter chip row.
 *
 * Layout per Sable §Screen 2:
 *   - Search field (90% width, radius-full, bg-elevated, divider border 1pt,
 *     leading `search` icon, placeholder "Search your tools")
 *   - Filter chip row below search (24pt chips, radius-full):
 *     All (default selected) / Mine / Shared with me
 *
 * Accessibility (T-0011-178):
 *   Filter chips: accessibilityRole="button", accessibilityState={{ selected }}
 *
 * T-0011-166..170, T-0011-178.
 */
import {StyleSheet, Text, TextInput, View, type ViewStyle} from 'react-native'
import {Pressable} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {libraryCopy} from './copy'

export type FilterChip = 'all' | 'mine' | 'shared'

interface Props {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeFilter: FilterChip
  onFilterChange: (filter: FilterChip) => void
  style?: ViewStyle
}

const CHIP_LABELS: Record<FilterChip, string> = {
  all: libraryCopy.filterAll,
  mine: libraryCopy.filterMine,
  shared: libraryCopy.filterShared,
}

const CHIP_ORDER: FilterChip[] = ['all', 'mine', 'shared']

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  style,
}: Props) {
  const theme = useAppShellTheme()

  return (
    <View style={[styles.container, style]}>
      {/* Search field — 90% width per Sable */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: theme['bg-elevated'],
            borderColor: theme.divider,
            borderRadius: theme.radii['radius-full'],
          },
        ]}
      >
        <Text
          style={[styles.searchIcon, {color: theme['fg-muted']}]}
          accessibilityElementsHidden
          importantForAccessibility="no"
          aria-hidden
        >
          {'🔍'}
        </Text>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={libraryCopy.searchPlaceholder}
          placeholderTextColor={theme['fg-muted']}
          accessibilityLabel="Search your tools"
          accessibilityRole="search"
          style={[
            styles.searchInput,
            {
              fontSize: theme.type.body.size,
              color: theme.fg,
            },
          ]}
          testID="library-search-input"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          hitSlop={{top: 4, bottom: 4}}
        />
      </View>

      {/* Filter chip row */}
      <View style={styles.chipRow}>
        {CHIP_ORDER.map(chip => {
          const isSelected = activeFilter === chip
          return (
            <Pressable
              key={chip}
              onPress={() => onFilterChange(chip)}
              accessibilityRole="button"
              accessibilityLabel={CHIP_LABELS[chip]}
              accessibilityState={{selected: isSelected}}
              hitSlop={{top: 10, bottom: 10}}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme['bg-elevated'],
                  borderColor: isSelected ? theme.accent : theme.divider,
                  borderRadius: theme.radii['radius-full'],
                },
              ]}
              testID={`filter-chip-${chip}`}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    fontSize: theme.type.caption.size,
                    fontWeight: isSelected ? '600' : (String(theme.type.caption.weight) as '400'),
                    color: isSelected ? theme['accent-fg'] : theme['fg-muted'],
                  },
                ]}
              >
                {CHIP_LABELS[chip]}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 36,
    width: '90%',
    alignSelf: 'center',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 24,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44, // ≥44pt touch target in one horizontal dimension; vertical covered by hitSlop={{top:10,bottom:10}}
  },
  chipText: {},
})
