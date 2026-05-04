/**
 * Home (Library) — Screen 2 of `docs/ux/app-creation-poc-ux.md`.
 *
 * State matrix per Sable:
 *   - Empty       → empty illustration + headline + subhead.
 *   - Loading     → 3 skeleton cards (T-0001-128 — exactly 3).
 *   - Populated   → list of library cards sorted by updatedAt DESC.
 *   - Error       → small icon + "Couldn't load your library" + retry CTA.
 *   - Pull-to-refresh re-runs the query in any state.
 *
 * The hero CTA "✨ Create new app" is sticky at top — it stays visible
 * regardless of which body state is showing (per Sable's state matrix).
 *
 * Settings gear: hit target ≥44pt (handled via `hitSlop` + a 44pt min
 * width). Tapping shows a "coming soon" toast — no Settings screen at M1.
 *
 * Data layer:
 *   - `useProjectsListQuery()` — TanStack Query, validated shape, sorted by
 *     server. Errors (HTTP, parse, network) all surface to the same error
 *     branch.
 *   - 401 mid-session: handled at the `apiFetch` layer / SessionProvider —
 *     the query throws, the auth state transitions, Navigation re-renders
 *     and Home unmounts. T-0001-129 verifies this end-to-end.
 *   - Cross-user (T-0001-127): when the session changes user, the Navigation
 *     parent invalidates the projects-list cache so the new user can never
 *     see User A's titles. The cross-user wire lives in SessionProvider /
 *     Navigation; the screen just renders what the query returns.
 */
import {Feather} from '@expo/vector-icons'
import {useCallback} from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native'

import {Button} from '#/components/Button'
import {SafeContainer} from '#/components/SafeContainer'
import {Skeleton} from '#/components/Skeleton'
import {useToast} from '#/components/ToastProvider'
import {useProjectsListQuery, type Project} from '#/state/queries/projects'
import {useTheme} from '#/theme'

import {EmptyLibrary} from './components/EmptyLibrary'
import {LibraryCard} from './components/LibraryCard'
import {homeCopy} from './copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>

const SKELETON_COUNT = 3

export function HomeScreen({navigation}: Props) {
  const theme = useTheme()
  const toast = useToast()
  const query = useProjectsListQuery()

  const handleCreate = useCallback(() => {
    navigation.navigate('Chat')
  }, [navigation])

  const handleOpenProject = useCallback(
    (projectId: string) => {
      navigation.navigate('AppRunner', {projectId})
    },
    [navigation],
  )

  const handleSettings = useCallback(() => {
    toast.show(homeCopy.settingsComingSoonToast)
  }, [toast])

  const handleRefresh = useCallback(() => {
    void query.refetch()
  }, [query])

  const renderCard = useCallback(
    ({item}: ListRenderItemInfo<Project>) => (
      <LibraryCard
        projectId={item.id}
        title={item.title}
        createdAt={item.createdAt}
        onPress={handleOpenProject}
      />
    ),
    [handleOpenProject],
  )

  const keyExtractor = useCallback((item: Project) => item.id, [])

  return (
    <SafeContainer>
      <View style={styles.topBar}>
        <Text
          style={[
            theme.typography.heading2,
            {color: theme.palette.text.primary},
          ]}
          accessibilityRole="header"
        >
          {homeCopy.title}
        </Text>
        <Pressable
          onPress={handleSettings}
          accessibilityRole="button"
          accessibilityLabel={homeCopy.settingsA11y}
          hitSlop={8}
          style={styles.settingsBtn}
          testID="home-settings"
        >
          <Feather name="settings" size={24} color={theme.palette.text.primary} />
        </Pressable>
      </View>

      <View style={styles.heroWrap}>
        <Button
          label={homeCopy.heroCta}
          accessibilityLabel={homeCopy.heroCtaA11y}
          onPress={handleCreate}
          variant="primary"
          style={styles.heroBtn}
          testID="home-hero-cta"
        />
      </View>

      <View style={styles.body}>
        {query.isPending ? (
          <LoadingBody />
        ) : query.isError ? (
          <ErrorBody onRetry={handleRefresh} />
        ) : query.data && query.data.length > 0 ? (
          <PopulatedBody
            data={query.data}
            renderCard={renderCard}
            keyExtractor={keyExtractor}
            refreshing={query.isFetching}
            onRefresh={handleRefresh}
          />
        ) : (
          <EmptyBody refreshing={query.isFetching} onRefresh={handleRefresh} />
        )}
      </View>
    </SafeContainer>
  )
}

// -- Body variants ---------------------------------------------------------

function LoadingBody() {
  // T-0001-128: exactly 3 skeleton cards. Each is testID-tagged so the
  // assertion `getAllByTestId('library-skeleton').length === 3` is precise.
  const skeletons = Array.from({length: SKELETON_COUNT}, (_, i) => i)
  return (
    <View style={styles.skeletonList}>
      <SectionDivider />
      {skeletons.map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton
            width="100%"
            height={68}
            radius={16}
            testID="library-skeleton"
          />
        </View>
      ))}
    </View>
  )
}

interface PopulatedBodyProps {
  data: Project[]
  renderCard: (info: ListRenderItemInfo<Project>) => JSX.Element
  keyExtractor: (item: Project) => string
  refreshing: boolean
  onRefresh: () => void
}

function PopulatedBody({
  data,
  renderCard,
  keyExtractor,
  refreshing,
  onRefresh,
}: PopulatedBodyProps) {
  const theme = useTheme()
  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderCard}
      ItemSeparatorComponent={ListDivider}
      ListHeaderComponent={SectionDivider}
      contentContainerStyle={styles.listContent}
      // Library lists are bounded — typical user has tens, not thousands.
      // A high `initialNumToRender` keeps the perceived perf snappy and
      // matches the test contract (T-0001-110: 100 cards rendered).
      initialNumToRender={100}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.palette.text.muted}
        />
      }
      testID="library-list"
    />
  )
}

interface RefreshableBodyProps {
  refreshing: boolean
  onRefresh: () => void
}

function EmptyBody({refreshing, onRefresh}: RefreshableBodyProps) {
  const theme = useTheme()
  return (
    <FlatList
      data={[null]}
      keyExtractor={() => 'empty'}
      renderItem={() => <EmptyLibrary />}
      contentContainerStyle={styles.flexGrow}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.palette.text.muted}
        />
      }
    />
  )
}

interface ErrorBodyProps {
  onRetry: () => void
}

function ErrorBody({onRetry}: ErrorBodyProps) {
  const theme = useTheme()
  return (
    <FlatList
      data={[null]}
      keyExtractor={() => 'error'}
      renderItem={() => (
        <View style={styles.errorBody} testID="library-error">
          <View
            style={[
              styles.errorIconWrap,
              {
                backgroundColor: theme.palette.bg.subtle,
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={28}
              color={theme.palette.text.muted}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          <Text
            style={[
              theme.typography.heading3,
              styles.errorHeadline,
              {color: theme.palette.text.primary},
            ]}
            accessibilityRole="header"
          >
            {homeCopy.errorHeadline}
          </Text>
          <Text
            style={[
              theme.typography.body,
              styles.errorSubhead,
              {color: theme.palette.text.muted},
            ]}
          >
            {homeCopy.errorSubhead}
          </Text>
          <View style={styles.errorCtaWrap}>
            <Button
              label={homeCopy.errorRetryCta}
              accessibilityLabel={homeCopy.errorRetryA11y}
              onPress={onRetry}
              variant="secondary"
              testID="library-retry"
            />
          </View>
        </View>
      )}
      contentContainerStyle={styles.flexGrow}
      refreshControl={
        <RefreshControl
          // Refreshing reflects the IN-FLIGHT retry, not an external state —
          // the parent owns that.
          refreshing={false}
          onRefresh={onRetry}
          tintColor={theme.palette.text.muted}
        />
      }
    />
  )
}

// -- Bits & pieces ---------------------------------------------------------

function SectionDivider() {
  const theme = useTheme()
  return (
    <Text
      style={[
        styles.sectionDivider,
        theme.typography.caption,
        {color: theme.palette.text.muted},
      ]}
    >
      {homeCopy.recentSection}
    </Text>
  )
}

function ListDivider() {
  return <View style={styles.itemSeparator} />
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  settingsBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroWrap: {paddingHorizontal: 24, paddingBottom: 16},
  heroBtn: {minHeight: 64},
  body: {flex: 1, paddingHorizontal: 24},
  sectionDivider: {paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase'},
  itemSeparator: {height: 12},
  listContent: {paddingBottom: 32},
  skeletonList: {gap: 0},
  skeletonRow: {marginBottom: 12},
  flexGrow: {flexGrow: 1, justifyContent: 'center'},
  errorBody: {alignItems: 'center', padding: 32, gap: 8},
  errorIconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorHeadline: {textAlign: 'center'},
  errorSubhead: {textAlign: 'center'},
  errorCtaWrap: {alignSelf: 'stretch', marginTop: 16},
})
