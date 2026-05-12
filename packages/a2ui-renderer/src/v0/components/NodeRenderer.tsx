/**
 * NodeRenderer — discriminated switch over all recognized node types.
 *
 * Step 4: 5 layout types (Screen, Section, Stack, Row, Card) + defensive default.
 * Step 5: +3 typography (Heading, Body, Caption) +4 display (Stat, Badge, Chip, Avatar)
 *         = 12 arms total.
 * Step 6: +5 inputs (TextField, NumberField, DateField, Picker, Switch)
 *         = 17 arms total.
 * Step 7: +5 lists (List, ListItem, SwipeableRow, EmptyState, LoadingState)
 *         = 22 arms total.
 * Step 8: +4 compound (ConditionalSection, ListSummary, MediaTray, ImagePicker)
 *         = 26 arms total.
 * Step 9: +2 actions (Button, FAB)
 *         = 28 arms total.
 * V1 Phase 1 Step 1: +3 foundation (Divider, Image, IconButton)
 *         = 31 arms total.
 * V1 Phase 1 Step 3: +2 display (AvatarGroup, Callout)
 *         = 33 arms total.
 * V1 Phase 1 Step 2: +6 inputs (MoneyField, TimeField, MultiPicker, Slider, RatingInput, SearchBar)
 *         = 39 arms total.
 * V1 Phase 1 Step 4: +4 lists (GridList, Carousel, Timeline, ErrorState)
 *         = 43 arms total.
 * V1 Phase 1 Step 5: +4 compound (TransactionRow, Receipt, MetricTile, StepList)
 *         = 47 arms total.
 * V1 Phase 1 Step 6: +2 compound (Calendar, Heatmap)
 *         = 49 arms total.
 * V1 Phase 1 Step 7: +4 content/media (Gallery, CommerceCard, BeforeAfter, DocumentPicker)
 *         = 53 arms total.
 *
 * Defense-in-depth: the schema should prevent unknown types from reaching here
 * via validateCrossRefs(). The default branch calls host.onUnknownNodeType()
 * for observability and returns null (renders nothing). This keeps the app
 * alive rather than crashing on a schema violation that slipped through.
 *
 * Per ADR-0006 §G: onUnknownNodeType is a separate signal from onNavigationError.
 */
import React from 'react'
import type {Node} from '@app-creator/protocol'
import {useHost} from '../host/HostContext.js'
import {ScreenRenderer} from './layout/Screen.js'
import {SectionRenderer} from './layout/Section.js'
import {StackRenderer} from './layout/Stack.js'
import {RowRenderer} from './layout/Row.js'
import {CardRenderer} from './layout/Card.js'
import {DividerRenderer} from './layout/Divider.js'
import {HeadingRenderer} from './typography/Heading.js'
import {BodyRenderer} from './typography/Body.js'
import {CaptionRenderer} from './typography/Caption.js'
import {StatRenderer} from './display/Stat.js'
import {BadgeRenderer} from './display/Badge.js'
import {ChipRenderer} from './display/Chip.js'
import {AvatarRenderer} from './display/Avatar.js'
import {AvatarGroupRenderer} from './display/AvatarGroup.js'
import {CalloutRenderer} from './display/Callout.js'
import {TextFieldRenderer} from './inputs/TextField.js'
import {NumberFieldRenderer} from './inputs/NumberField.js'
import {DateFieldRenderer} from './inputs/DateField.js'
import {PickerRenderer} from './inputs/Picker.js'
import {SwitchRenderer} from './inputs/Switch.js'
// V1 Phase 1 Step 2 — inputs tier expansion
import {MoneyFieldRenderer} from './inputs/MoneyField.js'
import {TimeFieldRenderer} from './inputs/TimeField.js'
import {MultiPickerRenderer} from './inputs/MultiPicker.js'
import {SliderRenderer} from './inputs/Slider.js'
import {RatingInputRenderer} from './inputs/RatingInput.js'
import {SearchBarRenderer} from './inputs/SearchBar.js'
import {ListRenderer} from './lists/List.js'
import {ListItemRenderer} from './lists/ListItem.js'
import {SwipeableRowRenderer} from './lists/SwipeableRow.js'
import {EmptyStateRenderer} from './lists/EmptyState.js'
import {LoadingStateRenderer} from './lists/LoadingState.js'
// V1 Phase 1 Step 4 — Lists & Data tier expansion
import {GridListRenderer} from './lists/GridList.js'
import {CarouselRenderer} from './lists/Carousel.js'
import {TimelineRenderer} from './lists/Timeline.js'
import {ErrorStateRenderer} from './lists/ErrorState.js'
import {ConditionalSectionRenderer} from './compound/ConditionalSection.js'
import {ListSummaryRenderer} from './compound/ListSummary.js'
import {MediaTrayRenderer} from './compound/MediaTray.js'
import {ImagePickerRenderer} from './compound/ImagePicker.js'
import {ImageRenderer} from './compound/Image.js'
// V1 Phase 1 Step 5 — Productivity domain compounds
import {TransactionRowRenderer} from './compound/TransactionRow.js'
import {ReceiptRenderer} from './compound/Receipt.js'
import {MetricTileRenderer} from './compound/MetricTile.js'
import {StepListRenderer} from './compound/StepList.js'
// V1 Phase 1 Step 6 — Date components
import {CalendarRenderer} from './compound/Calendar.js'
import {HeatmapRenderer} from './compound/Heatmap.js'
// V1 Phase 1 Step 7 — Content/Media expansion
import {GalleryRenderer} from './compound/Gallery.js'
import {CommerceCardRenderer} from './compound/CommerceCard.js'
import {BeforeAfterRenderer} from './compound/BeforeAfter.js'
import {DocumentPickerRenderer} from './compound/DocumentPicker.js'
import {ButtonRenderer} from './actions/Button.js'
import {FABRenderer} from './actions/FAB.js'
import {IconButtonRenderer} from './actions/IconButton.js'

export function NodeRenderer({node}: {node: Node}) {
  const host = useHost()

  switch (node.type) {
    // Layout tier (Step 4)
    case 'Screen':
      return <ScreenRenderer node={node} />
    case 'Section':
      return <SectionRenderer node={node} />
    case 'Stack':
      return <StackRenderer node={node} />
    case 'Row':
      return <RowRenderer node={node} />
    case 'Card':
      return <CardRenderer node={node} />
    // Layout tier — V1 Phase 1 Step 1
    case 'Divider':
      return <DividerRenderer node={node} />
    // Typography tier (Step 5)
    case 'Heading':
      return <HeadingRenderer node={node} />
    case 'Body':
      return <BodyRenderer node={node} />
    case 'Caption':
      return <CaptionRenderer node={node} />
    // Display tier (Step 5)
    case 'Stat':
      return <StatRenderer node={node} />
    case 'Badge':
      return <BadgeRenderer node={node} />
    case 'Chip':
      return <ChipRenderer node={node} />
    case 'Avatar':
      return <AvatarRenderer node={node} />
    // Display tier — V1 Phase 1 Step 3
    case 'AvatarGroup':
      return <AvatarGroupRenderer node={node} />
    case 'Callout':
      return <CalloutRenderer node={node} />
    // Inputs tier (Step 6)
    case 'TextField':
      return <TextFieldRenderer node={node} />
    case 'NumberField':
      return <NumberFieldRenderer node={node} />
    case 'DateField':
      return <DateFieldRenderer node={node} />
    case 'Picker':
      return <PickerRenderer node={node} />
    case 'Switch':
      return <SwitchRenderer node={node} />
    // Inputs tier — V1 Phase 1 Step 2
    case 'MoneyField':
      return <MoneyFieldRenderer node={node} />
    case 'TimeField':
      return <TimeFieldRenderer node={node} />
    case 'MultiPicker':
      return <MultiPickerRenderer node={node} />
    case 'Slider':
      return <SliderRenderer node={node} />
    case 'RatingInput':
      return <RatingInputRenderer node={node} />
    case 'SearchBar':
      return <SearchBarRenderer node={node} />
    // Lists tier (Step 7)
    case 'List':
      return <ListRenderer node={node} />
    case 'ListItem':
      return <ListItemRenderer node={node} />
    case 'SwipeableRow':
      return <SwipeableRowRenderer node={node} />
    case 'EmptyState':
      return <EmptyStateRenderer node={node} />
    case 'LoadingState':
      return <LoadingStateRenderer node={node} />
    // Lists tier — V1 Phase 1 Step 4
    case 'GridList':
      return <GridListRenderer node={node} />
    case 'Carousel':
      return <CarouselRenderer node={node} />
    case 'Timeline':
      return <TimelineRenderer node={node} />
    case 'ErrorState':
      return <ErrorStateRenderer node={node} />
    // Compound tier (Step 8)
    case 'ConditionalSection':
      return <ConditionalSectionRenderer node={node} />
    case 'ListSummary':
      return <ListSummaryRenderer node={node} />
    case 'MediaTray':
      return <MediaTrayRenderer node={node} />
    case 'ImagePicker':
      return <ImagePickerRenderer node={node} />
    // Compound tier — V1 Phase 1 Step 1
    case 'Image':
      return <ImageRenderer node={node} />
    // Compound tier — V1 Phase 1 Step 5
    case 'TransactionRow':
      return <TransactionRowRenderer node={node} />
    case 'Receipt':
      return <ReceiptRenderer node={node} />
    case 'MetricTile':
      return <MetricTileRenderer node={node} />
    case 'StepList':
      return <StepListRenderer node={node} />
    // Actions tier (Step 9)
    case 'Button':
      return <ButtonRenderer node={node} />
    case 'FAB':
      return <FABRenderer node={node} />
    // Actions tier — V1 Phase 1 Step 1
    case 'IconButton':
      return <IconButtonRenderer node={node} />
    // Date components tier — V1 Phase 1 Step 6
    case 'Calendar':
      return <CalendarRenderer node={node} />
    case 'Heatmap':
      return <HeatmapRenderer node={node} />
    // Content/Media tier — V1 Phase 1 Step 7
    case 'Gallery':
      return <GalleryRenderer node={node} />
    case 'CommerceCard':
      return <CommerceCardRenderer node={node} />
    case 'BeforeAfter':
      return <BeforeAfterRenderer node={node} />
    case 'DocumentPicker':
      return <DocumentPickerRenderer node={node} />
    default: {
      // Defense-in-depth: schema validation upstream should have caught this.
      // Calling host.onUnknownNodeType makes the violation observable to the host
      // app without crashing the renderer. Renders null (blank) as fallback.
      host.onUnknownNodeType?.((node as {type: string}).type)
      return null
    }
  }
}
