/**
 * sampleSpec — Milestone B demo spec.
 *
 * Updated at Step 10 from the Milestone A read-only spec to a full interactive
 * demo spec with stack navigation and state-driven interactions.
 *
 * Composition:
 *   - navigation: 'stack' (2 screens — list → detail)
 *   - Screen 1 (list): Task tracker with heading, stats, FAB to add tasks,
 *     list of tasks with EmptyState.
 *   - Screen 2 (detail): Task detail with heading, body, and a Back button.
 *
 * ID constraints: COMPONENT_ID_REGEX / COLLECTION_ID_REGEX = /^[a-z][a-zA-Z0-9_]{0,63}$/
 * Slot names: SlotNameSchema = /^[a-z][a-zA-Z0-9_]{0,63}$/
 *
 * T-0006-173: Integration test exercises DEMO_SPEC via <Renderer>.
 */
import type {Spec} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Milestone B demo spec — interactive task tracker with stack navigation
// ---------------------------------------------------------------------------
export const SAMPLE_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'stack',
  initialScreenId: 'list',
  collections: [
    {
      id: 'tasks',
      name: 'Tasks',
      fields: [
        {name: 'title', type: {type: 'string'}, required: true},
        {name: 'done', type: {type: 'boolean'}, required: false},
      ],
      syncMode: 'local',
      seedData: [
        {title: 'Review the sprint board', done: false},
        {title: 'Write release notes', done: true},
        {title: 'Schedule retrospective', done: false},
      ],
    },
  ],
  initialState: {},
  screens: [
    // -------------------------------------------------------------------------
    // Screen 1: Task list
    // -------------------------------------------------------------------------
    {
      id: 'list',
      title: 'My Tasks',
      root: {
        id: 'listScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {
            id: 'headerSection',
            type: 'Section',
            padding: 'space-md',
            children: [
              {id: 'titleHeading', type: 'Heading', text: 'My Tasks', level: 1},
              {
                id: 'statsRow',
                type: 'Row',
                gap: 'space-md',
                children: [
                  {
                    id: 'statTotal',
                    type: 'Stat',
                    label: 'total',
                    value: '3',
                  },
                  {
                    id: 'statDone',
                    type: 'Stat',
                    label: 'done',
                    value: '1',
                    delta: '+1',
                    deltaTone: 'positive',
                  },
                ],
              },
            ],
          },
          {
            id: 'taskListSection',
            type: 'Section',
            title: 'Tasks',
            padding: 'space-md',
            children: [
              {
                id: 'taskList',
                type: 'List',
                collectionId: 'tasks',
                itemLayout: 'standard',
                emptyState: {
                  id: 'emptyState',
                  type: 'EmptyState',
                  icon: 'list',
                  headline: 'No tasks yet',
                  body: 'Tap the + button to add your first task.',
                },
              },
            ],
          },
          {
            id: 'addFab',
            type: 'FAB',
            icon: 'plus',
            accessibilityLabel: 'Add task',
            action: {
              type: 'addItem',
              collection: 'tasks',
              item: {title: 'New task', done: false},
            },
          },
        ],
      },
    },
    // -------------------------------------------------------------------------
    // Screen 2: Task detail
    // -------------------------------------------------------------------------
    {
      id: 'detail',
      title: 'Task Detail',
      root: {
        id: 'detailScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {
            id: 'detailSection',
            type: 'Section',
            padding: 'space-md',
            children: [
              {id: 'detailHeading', type: 'Heading', text: 'Task Detail', level: 1},
              {
                id: 'detailBody',
                type: 'Body',
                text: 'Detailed task information goes here.',
                color: 'fg-muted',
              },
              {
                id: 'backBtn',
                type: 'Button',
                label: 'Back to Tasks',
                variant: 'secondary',
                action: {type: 'back'},
              },
            ],
          },
        ],
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Milestone A spec — preserved for regression use in step5-milestone-A.integration.test.tsx
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
