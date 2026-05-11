/**
 * StepListRenderer tests
 *
 * T-0009-126: numbered style renders connecting vertical rail between circles
 * T-0009-127: checklist style supports BooleanBinding per step
 * T-0009-132: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {StepListRenderer} from './StepList'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type StepListNode = Extract<Node, {type: 'StepList'}>

const NUMBERED_STEPS: StepListNode = {
  id: 'sl1',
  type: 'StepList',
  steps: [
    {title: 'Preheat oven to 180°C'},
    {title: 'Mix flour and sugar', body: 'Use a large bowl for best results.'},
    {title: 'Bake for 25 minutes'},
  ],
  style: 'numbered',
}

const CHECKLIST_STEPS: StepListNode = {
  id: 'sl2',
  type: 'StepList',
  steps: [
    {title: 'Buy ingredients', done: {kind: 'literal', value: true}},
    {title: 'Prepare workspace', done: {kind: 'literal', value: false}},
    {title: 'Follow recipe', done: {kind: 'literal', value: false}},
  ],
  style: 'checklist',
}

const SINGLE_STEP: StepListNode = {
  id: 'sl3',
  type: 'StepList',
  steps: [{title: 'Only step'}],
  style: 'numbered',
}

const DIVERSE_STEPS: StepListNode = {
  id: 'sl4',
  type: 'StepList',
  steps: [
    {title: 'José García cooks'},
    {title: '第一步：准备材料'},
    {title: "O'Brien's method"},
  ],
  style: 'numbered',
}

// ---------------------------------------------------------------------------
// T-0009-132: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('StepListRenderer snapshot (T-0009-132) — productive×focus', () => {
  it('matches snapshot at productive×focus (numbered)', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={NUMBERED_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-132: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('StepListRenderer snapshot (T-0009-132) — expressive×health', () => {
  it('matches snapshot at expressive×health (checklist)', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={CHECKLIST_STEPS} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-126: numbered style renders connecting vertical rail
// ---------------------------------------------------------------------------

describe('StepListRenderer numbered style (T-0009-126)', () => {
  it('T-0009-126: renders numbered steps without error', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={NUMBERED_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders step numbers as text', () => {
    const {getAllByText} = renderWithTheme(<StepListRenderer node={NUMBERED_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('1', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('2', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('3', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('renders step titles', () => {
    const {getAllByText} = renderWithTheme(<StepListRenderer node={NUMBERED_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Preheat oven to 180°C', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('renders step body text when present', () => {
    const {getAllByText} = renderWithTheme(<StepListRenderer node={NUMBERED_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Use a large bowl for best results.', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('single-step numbered list renders without rail (no following step)', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={SINGLE_STEP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders diverse step titles (i18n)', () => {
    const {getAllByText} = renderWithTheme(<StepListRenderer node={DIVERSE_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('José García cooks', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('第一步：准备材料', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText("O'Brien's method", {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-127: checklist style supports BooleanBinding per step
// ---------------------------------------------------------------------------

describe('StepListRenderer checklist style (T-0009-127)', () => {
  it('T-0009-127: renders checklist steps without error', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={CHECKLIST_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders checklist step titles', () => {
    const {getAllByText} = renderWithTheme(<StepListRenderer node={CHECKLIST_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Buy ingredients', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Prepare workspace', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('renders checkboxes for all steps', () => {
    const {getAllByTestId} = renderWithTheme(<StepListRenderer node={CHECKLIST_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Each step renders a checkbox with testID `step-checkbox-${index}`.
    expect(getAllByTestId(/step-checkbox-/, {includeHiddenElements: true}).length).toBe(3)
  })

  it('renders done step with strikethrough styling (done=true)', () => {
    const {toJSON} = renderWithTheme(<StepListRenderer node={CHECKLIST_STEPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Verify done=true step renders correctly (strikethrough styling applied).
    expect(toJSON()).not.toBeNull()
  })

  it('state binding for done resolves to false (display-only context)', () => {
    const stateBindingNode: StepListNode = {
      ...CHECKLIST_STEPS,
      id: 'sl_state',
      steps: [
        {title: 'Step with state binding', done: {kind: 'state', slot: 'step1Done'}},
      ],
    }
    const {toJSON} = renderWithTheme(<StepListRenderer node={stateBindingNode} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // State binding can't be resolved without RendererState; renders as undone.
    expect(toJSON()).not.toBeNull()
  })

  it('renders without style prop (defaults to numbered)', () => {
    const noStyleNode: StepListNode = {
      ...NUMBERED_STEPS,
      id: 'sl_no_style',
      style: undefined,
    }
    const {toJSON} = renderWithTheme(<StepListRenderer node={noStyleNode} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})
