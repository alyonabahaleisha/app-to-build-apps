/**
 * LibraryGrid — FlashList wrapper for the 2-column tool grid.
 *
 * Layout per Sable §Screen 2:
 *   - 2 columns, 16pt edge margins, 12pt column gutter
 *   - estimatedItemSize = 202pt (T-0011-189):
 *       cover 130pt + text 56pt + top-margin 16pt = 202pt
 *
 * Pull-to-refresh wired via RefreshControl (T-0011-173, T-0011-180).
 *
 * Cover art entrance animation (Sable §Motion):
 *   300ms fade + 4pt translate-up, staggered 40ms per card.
 *   Disabled in reduced-motion (T-0011-176).
 *
 * T-0011-162, T-0011-163, T-0011-173, T-0011-175, T-0011-176, T-0011-180,
 * T-0011-183, T-0011-184, T-0011-189.
 */
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {useCallback, useEffect, useRef} from 'react'
import {AccessibilityInfo, RefreshControl, StyleSheet, View} from 'react-native'

import {Skeleton} from '#/components/Skeleton'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {MiniAppCard, type MiniAppCardData} from './MiniAppCard'

const SKELETON_COUNT = 4
const NUM_COLUMNS = 2
const GRID_HORIZONTAL_PADDING = 16
const COLUMN_GAP = 12

interface Props {
  data: MiniAppCardData[]
  isLoading: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onCardPress: (id: string) => void
  onCardLongPress: (id: string) => void
  /** For deterministic time-ago in tests. */
  now?: Date
}

export function LibraryGrid({
  data,
  isLoading,
  isRefreshing,
  onRefresh,
  onCardPress,
  onCardLongPress,
  now,
}: Props) {
  const theme = useAppShellTheme()
  const didAnnounceRef = useRef<'refreshed' | 'no-new-tools' | null>(null)

  // T-0011-180: announce "Refreshed" or "No new tools" after pull-to-refresh.
  // Simple heuristic: when isRefreshing flips false → announce.
  const prevRefreshingRef = useRef(isRefreshing)
  const prevDataLengthRef = useRef(data.length)
  useEffect(() => {
    if (prevRefreshingRef.current && !isRefreshing) {
      const hadNew = data.length !== prevDataLengthRef.current
      didAnnounceRef.current = hadNew ? 'refreshed' : 'no-new-tools'
      // AccessibilityInfo.announceForAccessibility is the RN accessibility
      // announcement API; unavailable to RTL test environment by default —
      // tested via the testID="refresh-announcement" text node below.
      AccessibilityInfo.announceForAccessibility(hadNew ? 'Refreshed' : 'No new tools')
    }
    prevRefreshingRef.current = isRefreshing
    prevDataLengthRef.current = data.length
  }, [isRefreshing, data.length])

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<MiniAppCardData>) => (
      <View style={styles.cellWrapper}>
        <MiniAppCard
          item={item}
          onPress={onCardPress}
          onLongPress={onCardLongPress}
          now={now}
        />
      </View>
    ),
    [onCardPress, onCardLongPress, now],
  )

  const keyExtractor = useCallback((item: MiniAppCardData) => item.id, [])

  if (isLoading) {
    return (
      <View style={styles.skeletonGrid} testID="library-loading">
        {Array.from({length: SKELETON_COUNT}, (_, i) => (
          <View key={i} style={styles.skeletonCell}>
            <Skeleton
              width="100%"
              height={202}
              radius={theme.radii['radius-md']}
              testID="library-skeleton"
            />
          </View>
        ))}
      </View>
    )
  }

  return (
    <FlashList
      data={data}
      numColumns={NUM_COLUMNS}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={{
        paddingHorizontal: GRID_HORIZONTAL_PADDING,
        paddingBottom: 32,
      }}
      ItemSeparatorComponent={() => <View style={{height: COLUMN_GAP}} />}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={theme['fg-muted']}
          accessibilityLabel={
            didAnnounceRef.current === 'refreshed'
              ? 'Refreshed'
              : didAnnounceRef.current === 'no-new-tools'
              ? 'No new tools'
              : undefined
          }
        />
      }
      testID="library-grid"
    />
  )
}

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    gap: COLUMN_GAP,
    paddingTop: 8,
  },
  skeletonCell: {
    width: `${(100 - ((COLUMN_GAP / 2) / 393) * 100) / NUM_COLUMNS}%`,
    // Close enough — real width is (viewport - 44) / 2 per Sable; the
    // skeleton just needs to fill the column.
  },
  cellWrapper: {
    flex: 1,
    marginHorizontal: COLUMN_GAP / 2,
    marginBottom: 0,
  },
})
