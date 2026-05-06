/**
 * M1 eval prompt set — 30 prompts with archetype labels.
 *
 * Labels authored by Colby (2026-05-05). PM (Robert) and AI Eng to validate
 * post-Step-9 per ADR-0004 §Step 9 D4.
 *
 * Labeling methodology: each prompt was eyeballed against the 8-archetype
 * taxonomy in docs/product/M2-archetype-taxonomy.md. When a prompt could fit
 * two archetypes, the more dominant interaction pattern drove the choice.
 * Prompts flagged AMBIGUOUS needed extra thought — marked inline.
 *
 * Archetype closed set (8 + unknown):
 *   ListCRUD | Tracker | Calculator | Journal | Dashboard | SocialFeed |
 *   InfoDisplay | SimpleGame | unknown
 */

export type PromptEntry = {
  id: string
  prompt: string
  expected_archetype:
    | 'ListCRUD'
    | 'Tracker'
    | 'Calculator'
    | 'Journal'
    | 'Dashboard'
    | 'SocialFeed'
    | 'InfoDisplay'
    | 'SimpleGame'
    | 'unknown'
  /**
   * One-line rationale for the label choice.
   * Flags prompts where the labeling was difficult (for PM/AI Eng review).
   */
  label_note: string
}

export const EVAL_PROMPTS: PromptEntry[] = [
  // --------------------------------------------------------------------------
  // Calculator (3 prompts)
  // Clear "enter inputs, see derived result" pattern; single-screen by nature.
  // --------------------------------------------------------------------------
  {
    id: 'p01',
    prompt: 'tip calculator — enter bill amount and tip percentage, see the total and tip amount',
    expected_archetype: 'Calculator',
    label_note: 'Classic Calculator: numeric inputs, derived result, no persistence.',
  },
  {
    id: 'p02',
    prompt: 'a BMI calculator where I enter height and weight',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two numeric inputs, one derived result, single screen.',
  },
  {
    id: 'p03',
    prompt: 'unit converter for temperature between Celsius and Fahrenheit',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: single transformation, no data persistence required.',
  },

  // --------------------------------------------------------------------------
  // Tracker (4 prompts)
  // Repeated logging over time; streak or trend display.
  // --------------------------------------------------------------------------
  {
    id: 'p04',
    prompt: 'daily water intake tracker — log glasses of water and see if I hit my goal today',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily repeated logging (Counter), goal / streak view.',
  },
  {
    id: 'p05',
    prompt:
      'a habit tracker for three morning habits (meditation, exercise, journaling) with streak counts',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: multi-habit Toggle logging, streak display — canonical Tracker.',
  },
  {
    id: 'p06',
    prompt: 'mood tracker — tap how I feel each day and see my mood history as a list',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily single-input log with history list.',
  },
  {
    id: 'p07',
    prompt: 'step counter app that shows my step count and weekly progress',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: logged metric over time with trend; no CRUD semantics.',
  },

  // --------------------------------------------------------------------------
  // ListCRUD (4 prompts)
  // Collection management with create / edit / delete.
  // --------------------------------------------------------------------------
  {
    id: 'p08',
    prompt: 'grocery list app where I can add items, check them off, and delete checked ones',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: create / mark-done / delete items in a list.',
  },
  {
    id: 'p09',
    prompt: 'contact book — add contacts with name and phone number, view and delete them',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: create/read/delete records with a detail view.',
  },
  {
    id: 'p10',
    prompt: 'task manager with priorities — add tasks, set high/medium/low priority, mark complete',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: collection with metadata fields and status toggling.',
  },
  {
    id: 'p11',
    prompt: 'a simple bookmark app to save URLs with a title and short description',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: create and manage URL records; list → detail navigation.',
  },

  // --------------------------------------------------------------------------
  // Journal (3 prompts)
  // Longer-form dated entries; revisit past entries.
  // --------------------------------------------------------------------------
  {
    id: 'p12',
    prompt: 'daily journal — write a note each day and browse past entries',
    expected_archetype: 'Journal',
    label_note: 'Journal: free-form text entry dated to a day, entry list.',
  },
  {
    id: 'p13',
    prompt: 'gratitude journal app where I write three things I am grateful for each morning',
    expected_archetype: 'Journal',
    label_note: 'Journal: structured daily entries (3 fields), history list.',
  },
  {
    id: 'p14',
    prompt: 'dream diary — record dreams right when I wake up and search past dreams',
    expected_archetype: 'Journal',
    label_note:
      'Journal: long-form dated entries; search is a future enhancement but core is journaling.',
  },

  // --------------------------------------------------------------------------
  // Dashboard (3 prompts)
  // At-a-glance metrics, drill-down.
  // --------------------------------------------------------------------------
  {
    id: 'p15',
    prompt: 'personal finance overview — monthly income vs expenses with category breakdown',
    expected_archetype: 'Dashboard',
    label_note: 'Dashboard: summary metrics + drill-down by category.',
  },
  {
    id: 'p16',
    prompt: 'fitness dashboard showing today\'s steps, calories burned, and sleep hours',
    expected_archetype: 'Dashboard',
    label_note: 'Dashboard: multiple metric tiles at a glance; no repeated logging = not Tracker.',
  },
  {
    id: 'p17',
    prompt: 'app store ranking dashboard for my apps showing downloads and ratings over time',
    expected_archetype: 'Dashboard',
    label_note: 'Dashboard: multi-metric summary with trend; drill-down to per-app detail.',
  },

  // --------------------------------------------------------------------------
  // InfoDisplay (3 prompts)
  // Reference content; index → topic detail.
  // --------------------------------------------------------------------------
  {
    id: 'p18',
    prompt: 'a cheat sheet app for keyboard shortcuts — browse by category and tap to see details',
    expected_archetype: 'InfoDisplay',
    label_note: 'InfoDisplay: static reference content, index → detail navigation.',
  },
  {
    id: 'p19',
    prompt: 'recipe collection — browse recipes by category and view full instructions',
    expected_archetype: 'InfoDisplay',
    // AMBIGUOUS: Could be ListCRUD if the user edits recipes. Labeled InfoDisplay
    // because "browse recipes" implies read-only reference content, not CRUD.
    label_note:
      'InfoDisplay: read-only reference browsing. AMBIGUOUS — edges toward ListCRUD if editable.',
  },
  {
    id: 'p20',
    prompt: 'a travel guide for Paris showing attractions, restaurants, and tips by neighborhood',
    expected_archetype: 'InfoDisplay',
    label_note: 'InfoDisplay: static reference content organized by category.',
  },

  // --------------------------------------------------------------------------
  // SimpleGame (3 prompts)
  // Self-contained interaction; quiz, dice, flashcards.
  // --------------------------------------------------------------------------
  {
    id: 'p21',
    prompt: 'trivia quiz app with 10 questions and a final score',
    expected_archetype: 'SimpleGame',
    label_note: 'SimpleGame: self-contained quiz loop with score.',
  },
  {
    id: 'p22',
    prompt: 'flashcard app for learning Spanish vocabulary — flip cards to see the translation',
    expected_archetype: 'SimpleGame',
    // AMBIGUOUS: Could be InfoDisplay. Labeled SimpleGame because the interaction
    // is flip/reveal with a self-contained game loop (right/wrong tracking), not
    // passive reading.
    label_note:
      'SimpleGame: flip interaction + score/progress. AMBIGUOUS — edges toward InfoDisplay.',
  },
  {
    id: 'p23',
    prompt: 'a dice roller with six dice and the ability to hold individual dice for Yahtzee',
    expected_archetype: 'SimpleGame',
    label_note: 'SimpleGame: self-contained stateful game interaction.',
  },

  // --------------------------------------------------------------------------
  // SocialFeed (2 prompts)
  // Vertical list of cards + detail; sample data only.
  // --------------------------------------------------------------------------
  {
    id: 'p24',
    prompt: 'a mock Twitter-style feed with sample posts and a detail view for each post',
    expected_archetype: 'SocialFeed',
    label_note: 'SocialFeed: vertical card feed + post detail; sample data explicitly.',
  },
  {
    id: 'p25',
    prompt: 'a simple news reader with a list of headlines and full article view',
    expected_archetype: 'SocialFeed',
    // AMBIGUOUS: Could be InfoDisplay. Labeled SocialFeed because the card-feed
    // interaction pattern (vertical scroll + detail) is the canonical SocialFeed
    // shape, not the index → topic InfoDisplay shape.
    label_note:
      'SocialFeed: card feed + detail. AMBIGUOUS — edges toward InfoDisplay on read-only content.',
  },

  // --------------------------------------------------------------------------
  // unknown (4 prompts)
  // Prompts outside the 8 archetypes or genuinely ambiguous.
  // --------------------------------------------------------------------------
  {
    id: 'p26',
    prompt: 'an app to keep track of stuff for me',
    expected_archetype: 'unknown',
    label_note:
      "unknown: intentionally vague; no clear archetype pattern. Planner should fall back to M1 single-call for this.",
  },
  {
    id: 'p27',
    prompt: 'something useful for my daily life',
    expected_archetype: 'unknown',
    label_note: 'unknown: no identifiable domain or interaction pattern.',
  },
  {
    id: 'p28',
    prompt: 'a chat app where I can message my friends in real time',
    expected_archetype: 'unknown',
    label_note:
      'unknown: multi-actor app — explicitly out of taxonomy per M2-archetype-taxonomy.md.',
  },
  {
    id: 'p29',
    prompt: 'map app showing restaurants near me',
    expected_archetype: 'unknown',
    label_note: 'unknown: location-aware — explicitly out of M2 catalog scope.',
  },
  {
    id: 'p30',
    prompt: 'a reminder app that pings me when I have a task due',
    expected_archetype: 'unknown',
    label_note:
      'unknown: scheduled-trigger / background execution — out of M2 taxonomy (no background model).',
  },
]
