/**
 * CarouselRenderer — horizontal FlashList with pagination indicator.
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §Carousel):
 *   - Horizontal FlashList, snap-to-card on scroll.
 *   - cardWidth: snap (90% of container), peek (75%), full (100%).
 *   - Pagination indicator: dots row (6pt circles) or fraction "1 / N".
 *   - autoplay: advances every 4s. Hard-disabled under useReducedMotion() (T-0009-097).
 *
 * Accessibility:
 *   - accessibilityRole="adjustable" with value state (T-0009-096).
 *   - accessibilityLabel updates with current position ("Carousel, item 1 of N").
 *
 * Mutually exclusive: collectionId XOR cards. Renderer prefers cards when both
 * present (defensive — schema already rejects, but belt-and-suspenders).
 *
 * T-0009-096: autoplay advances card index every 4s under normal motion
 * T-0009-097: autoplay does NOT advance when useReducedMotion() returns true
 * T-0009-106: snapshots at productive×focus + expressive×health
 */
import React, {useCallback, useState, useEffect} from 'react'
import {Text, View, useWindowDimensions} from 'react-native'
import {FlashList} from '@shopify/flash-list'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ListItemContextProvider} from '../../state/ListItemContext.js'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'
import {NodeRenderer} from '../NodeRenderer.js'
import type {Row} from '../../state/types.js'

type CarouselNode = Extract<Node, {type: 'Carousel'}>

const AUTOPLAY_INTERVAL_MS = 4000

// Card-width fractions of container.
const CARD_WIDTH_FRACTION: Record<string, number> = {
  snap: 0.9,
  peek: 0.75,
  full: 1.0,
}

function DefaultCarouselCard({row, theme, cardWidth}: {row: Row; theme: ReturnType<typeof useTheme>; cardWidth: number}) {
  const h2Spec = theme.type.h2
  const bodySpec = theme.type.body
  const title = String(row['name'] ?? row['title'] ?? row['label'] ?? Object.values(row)[0] ?? '')
  const subtitle = String(row['subtitle'] ?? row['description'] ?? '')

  return (
    <View
      style={{
        width: cardWidth,
        backgroundColor: theme['bg-elevated'],
        borderRadius: theme.radii['radius-lg'],
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing['space-lg'],
        minHeight: 160,
      }}
    >
      <Text
        style={{
          fontSize: h2Spec.size,
          lineHeight: h2Spec.lineHeight,
          fontWeight: '600',
          color: theme.fg,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme['fg-muted'],
            textAlign: 'center',
            marginTop: theme.spacing['space-xs'],
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function CarouselRenderer({node}: {node: CarouselNode}) {
  const theme = useTheme()
  const {state} = useRendererStateContext()
  const {width: windowWidth} = useWindowDimensions()
  const reducedMotion = useReducedMotion()

  const [currentIndex, setCurrentIndex] = useState(0)

  // Resolve card width.
  const cardWidthMode = node.cardWidth ?? 'snap'
  const fraction = CARD_WIDTH_FRACTION[cardWidthMode] ?? 0.9
  const cardWidth = Math.floor(windowWidth * fraction)

  // Resolve indicator.
  const indicator = node.indicator ?? 'dots'

  // Resolve autoplay — hard-disabled when reduced motion is on (T-0009-097).
  const shouldAutoplay = (node.autoplay ?? false) && !reducedMotion

  // Determine data items: prefer cards over collectionId (defensive).
  let items: {id: string; data: Row | Node; index: number}[] = []

  if (node.cards && node.cards.length > 0) {
    items = (node.cards as Node[]).map((card, index) => ({
      id: card.id,
      data: card,
      index,
    }))
  } else if (node.collectionId) {
    const collection = state.collections.get(node.collectionId)
    if (collection) {
      items = collection.rowOrder
        .map((rowId, index) => {
          const row = collection.rows.get(rowId)
          if (!row) return null
          return {id: rowId, data: row, index}
        })
        .filter((entry): entry is {id: string; data: Row; index: number} => entry !== null)
    }
  }

  const totalCount = items.length

  // ADR-0006 §K exception #6 (formally registered in ADR-0009 Phase 1):
  // useEffect allowed here for the autoplay interval — setInterval is an imperative
  // side-effect with no synchronous equivalent. clearInterval in the cleanup function
  // prevents timer leaks on unmount. eslint.config.mjs ignores this file accordingly.
  useEffect(() => {
    if (!shouldAutoplay || totalCount === 0) return

    const intervalId = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % totalCount)
    }, AUTOPLAY_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [shouldAutoplay, totalCount])

  const handleViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      const first = viewableItems[0]
      if (first && first.index !== null) {
        setCurrentIndex(first.index)
      }
    },
    [],
  )

  if (totalCount === 0) {
    const h2Spec = theme.type.h2
    return (
      <View
        style={{alignItems: 'center', padding: theme.spacing['space-xl']}}
        accessibilityRole="adjustable"
        accessibilityLabel={node.accessibilityLabel ?? 'Carousel, empty'}
      >
        <Text style={{fontSize: h2Spec.size, color: theme['fg-muted']}}>
          No items
        </Text>
      </View>
    )
  }

  return (
    <View
      testID="carousel-container"
      accessibilityRole="adjustable"
      accessibilityLabel={
        node.accessibilityLabel ??
        `Carousel, item ${currentIndex + 1} of ${totalCount}`
      }
    >
      <FlashList
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => (item as {id: string}).id}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{itemVisiblePercentThreshold: 50}}
        renderItem={({item}: {item: unknown}) => {
          const entry = item as {id: string; data: Row | Node; index: number}
          const isNodeCard = typeof (entry.data as Record<string, unknown>)['type'] === 'string'

          if (isNodeCard) {
            return (
              <View style={{width: cardWidth, marginHorizontal: 4, borderRadius: theme.radii['radius-lg'], overflow: 'hidden'}}>
                <NodeRenderer node={entry.data as Node} />
              </View>
            )
          }

          return (
            <ListItemContextProvider
              value={{row: entry.data as Row, rowId: entry.id, index: entry.index}}
            >
              <DefaultCarouselCard
                row={entry.data as Row}
                theme={theme}
                cardWidth={cardWidth}
              />
            </ListItemContextProvider>
          )
        }}
      />

      {/* Pagination indicator */}
      {indicator === 'dots' && totalCount > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: theme.spacing['space-xs'],
            marginTop: theme.spacing['space-sm'],
          }}
        >
          {Array.from({length: totalCount}).map((_, i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === currentIndex ? theme.accent : theme.divider,
              }}
            />
          ))}
        </View>
      ) : indicator === 'fraction' && totalCount > 1 ? (
        <View style={{alignItems: 'center', marginTop: theme.spacing['space-sm']}}>
          <Text
            style={{
              fontSize: theme.type.caption.size,
              lineHeight: theme.type.caption.lineHeight,
              color: theme['fg-muted'],
            }}
          >
            {currentIndex + 1} / {totalCount}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
