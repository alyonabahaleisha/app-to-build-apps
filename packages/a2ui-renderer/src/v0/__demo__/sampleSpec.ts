/**
 * sampleSpec — Milestone A demo spec.
 *
 * A hardcoded Spec literal validated against SpecSchema at test time.
 * Composition:
 *   - 1 Screen (productive × focus stance)
 *   - 1 Section with title "Today"
 *   - 1 Heading (level 1, "Welcome")
 *   - 1 Body ("Here's what's on deck today.")
 *   - 1 Avatar at top
 *   - 1 Card containing:
 *     - 1 Row of 3 Stat children (tasks, done, pending)
 *     - 1 Row of 2 Badges + 1 Chip
 *
 * This is the "Milestone A receipt" — parse succeeds, renderer mounts it,
 * the integration test snapshots the result. No dispatcher needed (all
 * Typography and Display components are read-only at Step 5).
 *
 * T-0006-086: Integration test exercises this spec.
 */
import type {Spec} from '@app-creator/protocol'

export const SAMPLE_SPEC: Spec = {
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
        id: 'root_screen',
        type: 'Screen',
        safeArea: 'both',
        padding: 'space-lg',
        children: [
          // Avatar at top
          {
            id: 'top_avatar',
            type: 'Avatar',
            name: 'Alex Johnson',
            size: 'md',
          },
          // Section: Today
          {
            id: 'today_section',
            type: 'Section',
            title: 'Today',
            padding: 'space-md',
            children: [
              // Heading
              {
                id: 'welcome_heading',
                type: 'Heading',
                text: 'Welcome',
                level: 1,
              },
              // Body
              {
                id: 'deck_body',
                type: 'Body',
                text: "Here's what's on deck today.",
              },
              // Card with stats + badges + chip
              {
                id: 'summary_card',
                type: 'Card',
                elevation: 'raised',
                padding: 'space-md',
                children: [
                  // Row of 3 Stats
                  {
                    id: 'stats_row',
                    type: 'Row',
                    gap: 'space-md',
                    justify: 'space-between',
                    children: [
                      {
                        id: 'stat_tasks',
                        type: 'Stat',
                        value: '5',
                        label: 'tasks',
                        delta: '+2',
                        deltaTone: 'positive',
                      },
                      {
                        id: 'stat_done',
                        type: 'Stat',
                        value: '12',
                        label: 'done',
                      },
                      {
                        id: 'stat_pending',
                        type: 'Stat',
                        value: '2',
                        label: 'pending',
                        delta: '-1',
                        deltaTone: 'negative',
                      },
                    ],
                  },
                  // Row of 2 Badges + 1 Chip
                  {
                    id: 'badge_row',
                    type: 'Row',
                    gap: 'space-sm',
                    children: [
                      {
                        id: 'badge_active',
                        type: 'Badge',
                        text: 'Active',
                        tone: 'accent',
                      },
                      {
                        id: 'badge_overdue',
                        type: 'Badge',
                        text: 'Overdue',
                        tone: 'danger',
                      },
                      {
                        id: 'chip_filter',
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
