/**
 * LibraryScreen — V0 shell per ADR-0011 Step 8 + Sable's canvas-v0-ux.md
 * §Screen 2 / §Screen 2a.
 *
 * Layout (top → bottom):
 *   - Top safe area
 *   - Header bar (44pt): title "Library" left + trailing avatar (32pt)
 *   - Sticky search + filter row (SearchAndFilters)
 *   - Body: LibraryGrid (populated / loading / error) or EmptyState
 *   - Tab bar (host chrome — provided by ShellLayout in Step 6)
 *
 * States:
 *   - Loading    → 4 skeleton cards (shimmer disabled in reduced-motion)
 *   - Error      → inline banner above grid
 *   - Empty      → EmptyState (illustration + headline + 3 chips)
 *   - Populated  → LibraryGrid with 2-column FlashList
 *
 * Search: client-side case-insensitive substring on title (no refetch).
 * Filter: client-side on parentMiniAppId (All / Mine / Shared with me).
 * Sort: Recent (server sort, updatedAt DESC) — client-side Alphabetical
 *       is deferred to V0.5.
 *
 * Security (T-0011-170a): this screen NEVER renders specJson content.
 * Only MiniApp list fields (id, title, stance, accentPalette, coverArtSeed,
 * createdAt, parentMiniAppId) are surfaced. specJson lives only in the
 * MiniAppDetail response (fetched by RunScreen) — never in the list.
 *
 * Navigation: uses the 'Library' route name; the RootStackParamList entry
 * added in Step 8's types.ts update.
 *
 * T-0011-162..190 (31 tests in LibraryScreen.test.tsx).
 */
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet'
import {useCallback, useMemo, useRef, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useMiniAppsListQuery, type MiniApp} from '#/state/queries/miniApps'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {libraryCopy, noResultsCopy} from './copy'
import {EmptyState} from './EmptyState'
import {LibraryGrid} from './LibraryGrid'
import {LongPressActionSheet, type LongPressActionSheetRef} from './LongPressActionSheet'
import {SearchAndFilters, type FilterChip} from './SearchAndFilters'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>

/**
 * Named export — used directly in tests and as the navigator component.
 * T-0011-290 asserts testID="library-screen-root" is present.
 */
export function LibraryScreen({navigation}: Props) {
  const theme = useAppShellTheme()
  const query = useMiniAppsListQuery()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all')

  const actionSheetRef = useRef<LongPressActionSheetRef>(null)

  // ---------- navigation handlers ----------

  const handleCardPress = useCallback(
    (id: string) => {
      navigation.navigate('Run', {miniAppId: id})
    },
    [navigation],
  )

  const handleCardLongPress = useCallback((id: string) => {
    actionSheetRef.current?.present(id)
  }, [])

  const handleAvatarPress = useCallback(() => {
    // Settings sheet — ADR-0011 Phase 2 PR 5 wires it.
    // Stub: no-op in Step 8; the sheet ref will be wired in SettingsSheet PR.
  }, [])

  const handleEmptyChipPress = useCallback(
    (prompt: string) => {
      // T-0011-165, T-0011-170b: pre-fill Create input. Navigate to Create
      // with `prefilledPrompt` param. Do NOT auto-submit.
      navigation.navigate('Create', {prefilledPrompt: prompt})
    },
    [navigation],
  )

  const handleRefresh = useCallback(() => {
    void query.refetch()
  }, [query])

  // ---------- action sheet handlers ----------

  const handleOpen = useCallback(
    (id: string) => { navigation.navigate('Run', {miniAppId: id}) },
    [navigation],
  )

  const handleShare = useCallback((_id: string) => {
    // ADR-0008 PR 2/3 fills this in. Stub for Step 8.
  }, [])

  const handleMakeChanges = useCallback(
    (_id: string) => {
      // Navigate to Create with editingMiniAppId — Step 9 wires it.
    },
    [],
  )

  const handleRename = useCallback((_id: string) => {
    // RenameSheet — Step 10 wires it.
  }, [])

  const handleArchive = useCallback((_id: string) => {
    // useArchiveMiniAppMutation — wired in Step 10.
  }, [])

  const handleDelete = useCallback((_id: string) => {
    // useDeleteMiniAppMutation — wired in Step 10.
  }, [])

  // ---------- filter + search ----------

  const filteredData = useMemo(() => {
    if (!query.data) return []

    let items: MiniApp[] = query.data

    // Filter chip
    if (activeFilter === 'mine') {
      items = items.filter(m => m.parentMiniAppId === null)
    } else if (activeFilter === 'shared') {
      items = items.filter(m => m.parentMiniAppId !== null)
    }

    // Search — case-insensitive substring on title
    if (searchQuery.trim() !== '') {
      const lower = searchQuery.toLowerCase()
      items = items.filter(m => m.title.toLowerCase().includes(lower))
    }

    return items
  }, [query.data, activeFilter, searchQuery])

  // ---------- render ----------

  const isLoading = query.isPending
  const isError = query.isError
  const isRefreshing = query.isFetching && !query.isPending

  // Determine the "no shares" inline state: filter is "shared" and there are
  // no items from the server with parentMiniAppId !== null.
  const isSharedFilterWithNoShares =
    activeFilter === 'shared' &&
    !isLoading &&
    !isError &&
    (query.data?.every(m => m.parentMiniAppId === null) ?? true)

  // "No results" from search
  const isSearchWithNoResults =
    searchQuery.trim() !== '' &&
    !isLoading &&
    !isError &&
    filteredData.length === 0 &&
    !isSharedFilterWithNoShares

  // True empty state — no tools at all
  const isTrulyEmpty =
    !isLoading && !isError && (query.data?.length ?? 0) === 0 && searchQuery.trim() === ''

  const handlers = useMemo(
    () => ({
      onOpen: handleOpen,
      onShare: handleShare,
      onMakeChanges: handleMakeChanges,
      onRename: handleRename,
      onArchive: handleArchive,
      onDelete: handleDelete,
    }),
    [handleOpen, handleShare, handleMakeChanges, handleRename, handleArchive, handleDelete],
  )

  return (
    <BottomSheetModalProvider>
      <SafeContainer>
        <View style={styles.root} testID="library-screen-root">
          {/* Header bar */}
          <View style={[styles.header, {borderBottomColor: theme.divider}]}>
            <Text
              style={[
                styles.headerTitle,
                {
                  fontSize: theme.type.h1.size,
                  fontWeight: String(theme.type.h1.weight) as '700',
                  lineHeight: theme.type.h1.lineHeight,
                  color: theme.fg,
                },
              ]}
              accessibilityRole="header"
              testID="library-header-title"
            >
              {libraryCopy.title}
            </Text>

            {/* Avatar — 32pt circular, taps open Settings sheet */}
            <Pressable
              onPress={handleAvatarPress}
              accessibilityRole="button"
              accessibilityLabel={libraryCopy.avatarA11y}
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              style={[
                styles.avatar,
                {
                  backgroundColor: theme['bg-elevated'],
                  borderColor: theme.divider,
                },
              ]}
              testID="library-avatar"
            />
          </View>

          {/* Sticky search + filter row */}
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            style={styles.searchAndFilters}
          />

          {/* Body */}
          <View style={styles.body}>
            {isError ? (
              <ErrorBanner miniAppListShapeError={query.error} />
            ) : isTrulyEmpty ? (
              <EmptyState onChipPress={handleEmptyChipPress} />
            ) : isSharedFilterWithNoShares ? (
              <InlineEmpty
                copy={libraryCopy.noShares}
                testID="library-no-shares"
              />
            ) : isSearchWithNoResults ? (
              <InlineEmpty
                copy={noResultsCopy(searchQuery)}
                testID="library-no-results"
              />
            ) : (
              <LibraryGrid
                data={filteredData}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
                onCardPress={handleCardPress}
                onCardLongPress={handleCardLongPress}
              />
            )}
          </View>
        </View>

        <LongPressActionSheet ref={actionSheetRef} handlers={handlers} />
      </SafeContainer>
    </BottomSheetModalProvider>
  )
}

// -- Sub-components ----------------------------------------------------------

function ErrorBanner({miniAppListShapeError}: {miniAppListShapeError: Error | null}) {
  const theme = useAppShellTheme()

  // T-0011-190: MiniAppListShapeError → exact copy "Couldn't load your library."
  // T-0011-174: general errors → full banner with "Pull to retry."
  const isShapeError = miniAppListShapeError?.name === 'MiniAppListShapeError'
  const copy = isShapeError
    ? libraryCopy.errorBannerShape
    : libraryCopy.errorBanner

  return (
    <View
      style={[
        styles.errorBanner,
        {backgroundColor: theme['bg-elevated'], borderColor: theme.divider},
      ]}
      testID="library-error"
      accessibilityRole="alert"
    >
      <Text
        style={{
          fontSize: theme.type.body.size,
          fontWeight: String(theme.type.body.weight) as '400',
          lineHeight: theme.type.body.lineHeight,
          color: theme.fg,
        }}
      >
        {copy}
      </Text>
    </View>
  )
}

interface InlineEmptyProps {
  copy: string
  testID?: string
}

function InlineEmpty({copy, testID}: InlineEmptyProps) {
  const theme = useAppShellTheme()
  return (
    <View style={styles.inlineEmpty} testID={testID}>
      <Text
        style={{
          fontSize: theme.type.body.size,
          fontWeight: String(theme.type.body.weight) as '400',
          lineHeight: theme.type.body.lineHeight,
          color: theme['fg-muted'],
          textAlign: 'center',
        }}
      >
        {copy}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchAndFilters: {
    // sticky — FlashList's ListHeaderComponent handles sticking in populated
    // state; for empty/error states it sits naturally above the body.
  },
  body: {
    flex: 1,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
})
