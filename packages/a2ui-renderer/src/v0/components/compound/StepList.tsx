/**
 * StepListRenderer — numbered instructions or checklist of steps.
 *
 * V1 Phase 1 Step 5 (T-0009-125..128, T-0009-132).
 *
 * Visual (per ADR-0009 Step 5):
 *   - numbered style: index circles (1, 2, 3…) connected by a vertical rail
 *     line between consecutive circles. Circle: 28pt, accent fill, white text.
 *   - checklist style: each step has a checkbox bound via BooleanBinding.
 *     Done steps show a filled checkbox; undone show an empty circle.
 *
 * Each step has a required title and optional body text.
 *
 * The `done` BooleanBinding is only meaningful in checklist style. In numbered
 * style, it is ignored (steps are always shown as undone sequentially).
 *
 * Accessibility:
 *   accessibilityRole="list" on root; each step has accessibilityRole="text".
 *   Numbers are announced via text.
 *
 * T-0009-126: numbered style renders connecting vertical rail
 * T-0009-127: checklist style supports BooleanBinding per step
 * T-0009-132: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type StepListNode = Extract<Node, {type: 'StepList'}>
type Step = StepListNode['steps'][number]

// Circle size for numbered style (pt).
const CIRCLE_SIZE = 28
// Rail width connecting circles in numbered style.
const RAIL_WIDTH = 2

// Resolve BooleanBinding — only 'literal' bindings can be resolved without RendererState.
function resolveDone(done: Step['done']): boolean {
  if (!done) return false
  if (done.kind === 'literal') return done.value
  // state + collectionField bindings resolve to false in display-only context.
  return false
}

function NumberedStep({
  step,
  index,
  isLast,
  theme,
}: {
  step: Step
  index: number
  isLast: boolean
  theme: ReturnType<typeof useTheme>
}) {
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  return (
    <View
      style={{flexDirection: 'row'}}
      accessibilityRole="text"
      accessibilityLabel={`Step ${index + 1}: ${step.title}${step.body ? '. ' + step.body : ''}`}
    >
      {/* Left column: circle + vertical rail */}
      <View style={{alignItems: 'center', width: CIRCLE_SIZE + theme.spacing['space-sm']}}>
        {/* Number circle */}
        <View
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
        >
          <Text
            style={{
              fontSize: captionSpec.size,
              fontWeight: '600',
              color: theme['accent-fg'],
              lineHeight: captionSpec.size,
            }}
          >
            {index + 1}
          </Text>
        </View>

        {/* Vertical rail — T-0009-126: connects consecutive circles */}
        {!isLast ? (
          <View
            style={{
              flex: 1,
              width: RAIL_WIDTH,
              backgroundColor: theme.divider,
              marginTop: 2,
            }}
            accessibilityElementsHidden
          />
        ) : null}
      </View>

      {/* Right column: title + body */}
      <View
        style={{
          flex: 1,
          paddingLeft: theme.spacing['space-sm'],
          paddingBottom: isLast ? 0 : theme.spacing['space-md'],
        }}
      >
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: String(bodySpec.weight) as '400',
            color: theme.fg,
          }}
          accessibilityElementsHidden
        >
          {step.title}
        </Text>
        {step.body ? (
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-muted'],
              marginTop: 2,
            }}
            accessibilityElementsHidden
          >
            {step.body}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function ChecklistStep({
  step,
  index,
  theme,
}: {
  step: Step
  index: number
  theme: ReturnType<typeof useTheme>
}) {
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption
  const done = resolveDone(step.done)

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: theme.spacing['space-sm'],
      }}
      accessibilityRole="text"
      accessibilityLabel={`${done ? 'Completed' : 'Pending'}: ${step.title}${step.body ? '. ' + step.body : ''}`}
    >
      {/* Checkbox — T-0009-127: BooleanBinding drives checked state */}
      <View
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          borderWidth: 2,
          borderColor: done ? theme.accent : theme.divider,
          backgroundColor: done ? theme.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.spacing['space-sm'],
          flexShrink: 0,
        }}
        accessibilityElementsHidden
        testID={`step-checkbox-${index}`}
      >
        {done ? (
          <Text
            style={{
              color: theme['accent-fg'],
              fontSize: captionSpec.size,
              fontWeight: '700',
              lineHeight: captionSpec.size,
            }}
          >
            ✓
          </Text>
        ) : null}
      </View>

      {/* Text */}
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: String(bodySpec.weight) as '400',
            color: done ? theme['fg-muted'] : theme.fg,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
          accessibilityElementsHidden
        >
          {step.title}
        </Text>
        {step.body ? (
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-muted'],
              marginTop: 2,
            }}
            accessibilityElementsHidden
          >
            {step.body}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export function StepListRenderer({node}: {node: StepListNode}) {
  const theme = useTheme()

  const style = node.style ?? 'numbered'
  const a11yLabel =
    node.accessibilityLabel ??
    `${style === 'checklist' ? 'Checklist' : 'Steps'}, ${node.steps.length} item${node.steps.length !== 1 ? 's' : ''}`

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={a11yLabel}
      style={{
        paddingHorizontal: theme.spacing['space-md'],
        paddingVertical: theme.spacing['space-sm'],
      }}
    >
      {node.steps.map((step, index) => {
        if (style === 'checklist') {
          return (
            <ChecklistStep
              key={index}
              step={step}
              index={index}
              theme={theme}
            />
          )
        }
        return (
          <NumberedStep
            key={index}
            step={step}
            index={index}
            isLast={index === node.steps.length - 1}
            theme={theme}
          />
        )
      })}
    </View>
  )
}
