/**
 * sampleSpec — Step 13 re-export shim.
 *
 * The canonical demo specs now live in @app-creator/protocol/test/fixtures.demo.
 * This file re-exports them so existing imports inside this package continue to
 * resolve without churn (step5-milestone-A.integration.test.tsx, nav/Renderer.test.tsx).
 *
 * SAMPLE_SPEC_MILESTONE_A is kept inline — it is a Step 5 read-only spec used
 * only by the Milestone A integration test and has no place in the protocol
 * package (which targets the production API surface).
 *
 * T-0006-173: Integration test exercises SAMPLE_SPEC via <Renderer>.
 */
import type {Spec} from '@app-creator/protocol'
export {
  DEMO_SPEC_LIST_CRUD as SAMPLE_SPEC,
  DEMO_SPEC_LIST_CRUD,
  DEMO_SPEC_TRACKER,
  DEMO_SPEC_JOURNAL,
  DEMO_SPEC_CALCULATOR,
  DEMO_SPECS,
} from '@app-creator/protocol/test/fixtures.demo'

// ---------------------------------------------------------------------------
// Milestone A spec — preserved for regression use in step5-milestone-A.integration.test.tsx
// This is a read-only display spec (Layout + Typography + Display only).
// Not promoted to the protocol package — it tests the renderer in isolation,
// not the LLM's output contract.
// ---------------------------------------------------------------------------
export const SAMPLE_SPEC_MILESTONE_A: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  initialScreenId: 'main',
  collections: [],
  screens: [
    {
      id: 'main',
      title: 'My Tasks',
      root: {
        id: 'rootScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {
            id: 'topAvatar',
            type: 'Avatar',
            name: 'Alex Johnson',
            size: 'md',
          },
          {
            id: 'todaySection',
            type: 'Section',
            title: 'Today',
            padding: 'space-md',
            children: [
              {
                id: 'welcomeHeading',
                type: 'Heading',
                text: 'Welcome',
                level: 1,
              },
              {
                id: 'deckBody',
                type: 'Body',
                text: "Here's what's on deck today.",
              },
              {
                id: 'summaryCard',
                type: 'Card',
                elevation: 'raised',
                padding: 'space-md',
                children: [
                  {
                    id: 'statsRow',
                    type: 'Row',
                    gap: 'space-md',
                    justify: 'space-between',
                    children: [
                      {
                        id: 'statTasks',
                        type: 'Stat',
                        value: '5',
                        label: 'tasks',
                        delta: '+2',
                        deltaTone: 'positive',
                      },
                      {
                        id: 'statDone',
                        type: 'Stat',
                        value: '12',
                        label: 'done',
                      },
                      {
                        id: 'statPending',
                        type: 'Stat',
                        value: '2',
                        label: 'pending',
                        delta: '-1',
                        deltaTone: 'negative',
                      },
                    ],
                  },
                  {
                    id: 'badgeRow',
                    type: 'Row',
                    gap: 'space-sm',
                    children: [
                      {
                        id: 'badgeActive',
                        type: 'Badge',
                        text: 'Active',
                        tone: 'accent',
                      },
                      {
                        id: 'badgeOverdue',
                        type: 'Badge',
                        text: 'Overdue',
                        tone: 'danger',
                      },
                      {
                        id: 'chipFilter',
                        type: 'Chip',
                        text: 'All',
                        selected: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
}
