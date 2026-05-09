/**
 * NodeRenderer — discriminated switch over all recognized node types.
 *
 * Step 4: 5 layout types (Screen, Section, Stack, Row, Card) + defensive default.
 * Step 5: +3 typography (Heading, Body, Caption) +4 display (Stat, Badge, Chip, Avatar)
 *         = 12 arms total.
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
import {HeadingRenderer} from './typography/Heading.js'
import {BodyRenderer} from './typography/Body.js'
import {CaptionRenderer} from './typography/Caption.js'
import {StatRenderer} from './display/Stat.js'
import {BadgeRenderer} from './display/Badge.js'
import {ChipRenderer} from './display/Chip.js'
import {AvatarRenderer} from './display/Avatar.js'

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
    default: {
      // Defense-in-depth: schema validation upstream should have caught this.
      // Calling host.onUnknownNodeType makes the violation observable to the host
      // app without crashing the renderer. Renders null (blank) as fallback.
      host.onUnknownNodeType?.((node as {type: string}).type)
      return null
    }
  }
}
