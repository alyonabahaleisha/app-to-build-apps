/**
 * fixtures.demo.ts — Step 13 demo specs (ADR-0006 §Step 13).
 *
 * Four hardcoded V0 specs, one per archetype:
 *   - DEMO_SPEC_LIST_CRUD   (ListCRUD)   — interactive task tracker (Milestone B spec)
 *   - DEMO_SPEC_TRACKER     (Tracker)    — habit tracker with daily toggle
 *   - DEMO_SPEC_JOURNAL     (Journal)    — diary with text entry
 *   - DEMO_SPEC_CALCULATOR  (Calculator) — simple number-crunching tool
 *
 * All specs are valid against SpecSchema + validateCrossRefs.
 *
 * Used by:
 *   - packages/a2ui-renderer/src/v0/__demo__/sampleSpec.ts (re-exports SAMPLE_SPEC)
 *   - packages/a2ui-renderer/src/v0/__demo__/step13-emulator-demo.integration.test.tsx
 *   - apps/mobile/src/screens/AppRunner/index.tsx (dev-mode demo picker)
 */
import type {Spec} from '../src/index.js'

// ---------------------------------------------------------------------------
// ListCRUD — interactive task tracker (productive × focus, stack nav)
// This is the Milestone B spec; also re-exported as SAMPLE_SPEC.
// ---------------------------------------------------------------------------

export const DEMO_SPEC_LIST_CRUD: Spec = {
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
                  {id: 'statTotal', type: 'Stat', label: 'total', value: '3'},
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
// Tracker — daily habit tracker (productive × health, tabs nav)
// ---------------------------------------------------------------------------

export const DEMO_SPEC_TRACKER: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'health',
  coverIcon: 'check-circle',
  navigation: 'tabs',
  initialScreenId: 'today',
  collections: [
    {
      id: 'habits',
      name: 'Habits',
      fields: [
        {name: 'name', type: {type: 'string'}, required: true},
        {name: 'streak', type: {type: 'number'}, required: false},
      ],
      syncMode: 'local',
      seedData: [
        {name: 'Morning walk', streak: 5},
        {name: 'Read 20 pages', streak: 3},
        {name: 'Drink water', streak: 12},
      ],
    },
  ],
  initialState: {},
  screens: [
    {
      id: 'today',
      title: 'Today',
      root: {
        id: 'todayScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {id: 'todayHeading', type: 'Heading', text: "Today's Habits", level: 1},
          {
            id: 'streakRow',
            type: 'Row',
            gap: 'space-md',
            children: [
              {id: 'statStreak', type: 'Stat', label: 'best streak', value: '12'},
              {
                id: 'statDone',
                type: 'Stat',
                label: 'done today',
                value: '2',
                delta: '+2',
                deltaTone: 'positive',
              },
            ],
          },
          {
            id: 'habitList',
            type: 'List',
            collectionId: 'habits',
            itemLayout: 'standard',
            emptyState: {
              id: 'habitEmpty',
              type: 'EmptyState',
              icon: 'check-circle',
              headline: 'No habits yet',
              body: 'Add a habit to start tracking.',
            },
          },
          {
            id: 'addHabitFab',
            type: 'FAB',
            icon: 'plus',
            accessibilityLabel: 'Add habit',
            action: {
              type: 'addItem',
              collection: 'habits',
              item: {name: 'New habit', streak: 0},
            },
          },
        ],
      },
    },
    {
      id: 'history',
      title: 'History',
      root: {
        id: 'historyScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {id: 'historyHeading', type: 'Heading', text: 'Habit History', level: 1},
          {
            id: 'historyBody',
            type: 'Body',
            text: 'Your completed habits will appear here.',
            color: 'fg-muted',
          },
        ],
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Journal — simple diary (expressive × social, stack nav)
// ---------------------------------------------------------------------------

export const DEMO_SPEC_JOURNAL: Spec = {
  version: 1,
  archetype: 'Journal',
  stance: 'expressive',
  palette: 'social',
  coverIcon: 'book-open',
  navigation: 'stack',
  initialScreenId: 'entries',
  collections: [
    {
      id: 'entries',
      name: 'Journal Entries',
      fields: [
        {name: 'title', type: {type: 'string'}, required: true},
        {name: 'body', type: {type: 'string'}, required: false},
      ],
      syncMode: 'local',
      seedData: [
        {title: 'First day', body: 'Started journaling today.'},
        {title: 'Progress', body: 'Things are looking up.'},
      ],
    },
  ],
  initialState: {},
  screens: [
    {
      id: 'entries',
      title: 'My Journal',
      root: {
        id: 'entriesScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {id: 'journalHeading', type: 'Heading', text: 'My Journal', level: 1},
          {
            id: 'entryCount',
            type: 'Badge',
            text: '2 entries',
            tone: 'accent',
          },
          {
            id: 'entryList',
            type: 'List',
            collectionId: 'entries',
            itemLayout: 'standard',
            emptyState: {
              id: 'journalEmpty',
              type: 'EmptyState',
              icon: 'book-open',
              headline: 'No entries yet',
              body: 'Tap + to write your first entry.',
            },
          },
          {
            id: 'addEntryFab',
            type: 'FAB',
            icon: 'plus',
            accessibilityLabel: 'New entry',
            action: {
              type: 'addItem',
              collection: 'entries',
              item: {title: 'New entry', body: ''},
            },
          },
        ],
      },
    },
    {
      id: 'compose',
      title: 'New Entry',
      root: {
        id: 'composeScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {id: 'composeHeading', type: 'Heading', text: 'New Entry', level: 1},
          {
            id: 'composePlaceholder',
            type: 'Body',
            text: 'Write your journal entry here.',
            color: 'fg-muted',
          },
          {
            id: 'saveBtn',
            type: 'Button',
            label: 'Save Entry',
            variant: 'primary',
            action: {type: 'back'},
          },
        ],
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Calculator — simple number-crunching tool (productive × money, no-nav)
// ---------------------------------------------------------------------------

export const DEMO_SPEC_CALCULATOR: Spec = {
  version: 1,
  archetype: 'Calculator',
  stance: 'productive',
  palette: 'money',
  coverIcon: 'dollar-sign',
  navigation: 'none',
  initialScreenId: 'main',
  collections: [],
  initialState: {
    valueA: 0,
    valueB: 0,
    result: 0,
  },
  screens: [
    {
      id: 'main',
      title: 'Calculator',
      root: {
        id: 'mainScreen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          {id: 'calcHeading', type: 'Heading', text: 'Calculator', level: 1},
          {
            id: 'resultSection',
            type: 'Section',
            padding: 'space-md',
            children: [
              {
                id: 'resultStat',
                type: 'Stat',
                label: 'result',
                value: '0',
              },
              {
                id: 'statA',
                type: 'Stat',
                label: 'value A',
                value: '0',
              },
              {
                id: 'statB',
                type: 'Stat',
                label: 'value B',
                value: '0',
              },
            ],
          },
          {
            id: 'inputSection',
            type: 'Section',
            padding: 'space-md',
            children: [
              {
                id: 'fieldA',
                type: 'NumberField',
                label: 'Value A',
                valueBinding: {kind: 'state', slot: 'valueA'},
              },
              {
                id: 'fieldB',
                type: 'NumberField',
                label: 'Value B',
                valueBinding: {kind: 'state', slot: 'valueB'},
              },
            ],
          },
          {
            id: 'actionsRow',
            type: 'Row',
            gap: 'space-md',
            children: [
              {
                id: 'addBtn',
                type: 'Button',
                label: 'Add',
                variant: 'primary',
                action: {type: 'set', target: 'result', value: 0},
              },
              {
                id: 'resetBtn',
                type: 'Button',
                label: 'Reset',
                variant: 'secondary',
                action: {type: 'set', target: 'result', value: 0},
              },
            ],
          },
        ],
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Convenience map — keyed by archetype for AppRunner demo picker
// ---------------------------------------------------------------------------

export const DEMO_SPECS: Record<string, Spec> = {
  ListCRUD: DEMO_SPEC_LIST_CRUD,
  Tracker: DEMO_SPEC_TRACKER,
  Journal: DEMO_SPEC_JOURNAL,
  Calculator: DEMO_SPEC_CALCULATOR,
}

// Re-exported as SAMPLE_SPEC for backwards-compat with AppRunner (Step 11)
// and the renderer package root. Removed when ADR-0007 lands.
export const SAMPLE_SPEC = DEMO_SPEC_LIST_CRUD
