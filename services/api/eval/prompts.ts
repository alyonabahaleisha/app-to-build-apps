/**
 * V0 + V1 eval prompt sets — ADR-0007 Step 7 + ADR-0009 Step 10.
 *
 * Five exports:
 *   ARCHETYPE_PROMPTS              — 100 prompts, 25 per archetype (ListCRUD, Tracker, Journal, Calculator)
 *   OUT_OF_SCOPE_DETECTION_PROMPTS — 30 prompts, 6 per capability (image_gen, vision, chat, transcription, classification)
 *   OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS — 30 in-scope prompts that brush against out-of-scope capabilities
 *   V1_ARCHETYPE_PROMPTS           — 60 V1-exercising prompts, 15 per archetype (ADR-0009 Step 10)
 *   RE_PROMPT_CONTINUITY_PROMPTS   — 5 re-prompt continuity pairs (ADR-0009 Step 10)
 *
 * Total: 225 prompts (100 + 30 + 30 + 60 + 5). T-0009-221.
 *
 * Labeling methodology: each prompt maps unambiguously to the labeled archetype or capability.
 * V1 prompts target at least one V1 component each; components are noted inline.
 * Ambiguous cases are noted inline.
 *
 * T-0007-152: ARCHETYPE_PROMPTS.length === 100
 * T-0007-153: 25 per archetype (4 × 25 = 100)
 * T-0007-154: expected_archetype in [ListCRUD, Tracker, Journal, Calculator]
 * T-0007-155: OUT_OF_SCOPE_DETECTION_PROMPTS.length === 30
 * T-0007-156: 6 per capability (5 × 6 = 30)
 * T-0007-157: expected_capability in closed enum, no 'unknown'
 * T-0007-158: OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS.length === 30
 * T-0007-159: each has expected_archetype + brushes_against
 * T-0009-221: total exported prompts === 225 (100 + 30 + 30 + 60 + 5)
 * T-0009-222: V1_ARCHETYPE_PROMPTS has 60 entries, 15 per archetype
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type V0Archetype = 'ListCRUD' | 'Tracker' | 'Journal' | 'Calculator'

export type OutOfScopeCapability = 'image_gen' | 'vision' | 'chat' | 'transcription' | 'classification'

export type PromptEntry = {
  id: string
  prompt: string
  expected_archetype: V0Archetype
  label_note: string
}

export type DetectionEntry = {
  id: string
  prompt: string
  expected_capability: OutOfScopeCapability
  label_note: string
}

export type FalsePositiveEntry = {
  id: string
  prompt: string
  expected_archetype: V0Archetype
  brushes_against: OutOfScopeCapability
  label_note: string
}

// ---------------------------------------------------------------------------
// ARCHETYPE_PROMPTS — 100 prompts, 25 per archetype
// ---------------------------------------------------------------------------

export const ARCHETYPE_PROMPTS: PromptEntry[] = [
  // --------------------------------------------------------------------------
  // ListCRUD — 25 prompts
  // Pattern: collection management with create / edit / delete operations.
  // --------------------------------------------------------------------------
  {
    id: 'lc-01',
    prompt: 'grocery list app where I can add items, check them off, and delete checked ones',
    expected_archetype: 'ListCRUD',
    label_note: 'Classic ListCRUD: create, check, delete items in a named collection.',
  },
  {
    id: 'lc-02',
    prompt: 'contact book — add contacts with name and phone number, view and delete them',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: create/read/delete records with a detail view.',
  },
  {
    id: 'lc-03',
    prompt: 'task manager with priorities — add tasks, set high/medium/low priority, mark complete',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: collection with metadata fields and status toggling.',
  },
  {
    id: 'lc-04',
    prompt: 'a simple bookmark app to save URLs with a title and short description',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: create and manage URL records; list → detail navigation.',
  },
  {
    id: 'lc-05',
    prompt: 'reading list app — add books with title and author, mark when finished',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: book records with a done/not-done toggle.',
  },
  {
    id: 'lc-06',
    prompt: 'password vault — add logins with service name, username, and password',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: sensitive record management, create/delete, no streaming.',
  },
  {
    id: 'lc-07',
    prompt: 'movie watchlist — add movies I want to see, mark watched, delete old ones',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: watchlist with watched-status toggle.',
  },
  {
    id: 'lc-08',
    prompt: 'packing list for trips — add items by category, check off as I pack',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: categorized checklist with check-off mechanic.',
  },
  {
    id: 'lc-09',
    prompt: 'recipe book — save recipes with ingredients and steps, browse and delete',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: recipe records with multi-field detail view.',
  },
  {
    id: 'lc-10',
    prompt: 'wish list app for Christmas gifts — add items with price estimates, check off when bought',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: gift records with a bought toggle and price field.',
  },
  {
    id: 'lc-11',
    prompt: 'chore assignment app — add chores, assign to a family member, mark done',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: chore records with assignment + done fields.',
  },
  {
    id: 'lc-12',
    prompt: 'plant care log — add my plants with watering schedule, mark each watering',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: plant records with a care-action log (add/mark pattern).',
  },
  {
    id: 'lc-13',
    prompt: 'subscription tracker — add monthly subscriptions with cost, delete cancelled ones',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: subscription records; delete-on-cancel is a CRUD operation.',
  },
  {
    id: 'lc-14',
    prompt: 'meeting notes list — add meeting titles with attendees and action items, browse later',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: meeting record management with multi-field detail.',
  },
  {
    id: 'lc-15',
    prompt: 'bug tracker for personal projects — add issues with severity, mark resolved, delete closed',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: issue records with severity + resolved-status fields.',
  },
  {
    id: 'lc-16',
    prompt: 'vocabulary flashcard deck — add word/definition pairs, browse, delete mastered cards',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: card records with add/delete; study logic is incidental.',
  },
  {
    id: 'lc-17',
    prompt: 'garage inventory — add items with location and condition, edit when moved',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: inventory records with location and condition fields.',
  },
  {
    id: 'lc-18',
    prompt: 'pet care schedule — add pets, assign tasks like feeding and vet visits, mark complete',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: pet records with associated task list.',
  },
  {
    id: 'lc-19',
    prompt: 'project idea list — jot down app ideas with one-line descriptions, delete when built',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: idea records with minimal fields.',
  },
  {
    id: 'lc-20',
    prompt: 'wine cellar log — add bottles with vintage and variety, mark when opened',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: bottle records with vintage/variety fields and opened toggle.',
  },
  {
    id: 'lc-21',
    prompt: 'shopping history — log every purchase with store and amount, browse past receipts',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: purchase records with browse/delete; no aggregation = not Tracker.',
  },
  {
    id: 'lc-22',
    prompt: 'team skill roster — add teammates, list their skills, edit or remove people',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: person records with skills sub-list.',
  },
  {
    id: 'lc-23',
    prompt: 'event planner — add upcoming events with date and location, delete past ones',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: event records with date field; no recurring logging = not Tracker.',
  },
  {
    id: 'lc-24',
    prompt: 'hiking trail list — save trails I want to hike with difficulty rating, mark completed',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: trail records with rating and completed-toggle.',
  },
  {
    id: 'lc-25',
    prompt: 'doctor appointment list — add appointments with doctor name and date, mark attended',
    expected_archetype: 'ListCRUD',
    label_note: 'ListCRUD: appointment records with attended-toggle; no repeated metric logging.',
  },

  // --------------------------------------------------------------------------
  // Tracker — 25 prompts
  // Pattern: repeated metric logging over time; goal or streak display.
  // --------------------------------------------------------------------------
  {
    id: 'tr-01',
    prompt: 'daily water intake tracker — log glasses of water and see if I hit my goal today',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily repeated logging (counter increment), goal view.',
  },
  {
    id: 'tr-02',
    prompt: 'a habit tracker for three morning habits (meditation, exercise, journaling) with streak counts',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: multi-habit toggle logging, streak display — canonical Tracker.',
  },
  {
    id: 'tr-03',
    prompt: 'mood tracker — tap how I feel each day and see my mood history as a list',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily single-input log with history list.',
  },
  {
    id: 'tr-04',
    prompt: 'step counter app that shows my step count and weekly progress',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: logged metric over time with trend; no CRUD semantics.',
  },
  {
    id: 'tr-05',
    prompt: 'sleep tracker — log bedtime and wake time each night, see average sleep duration',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: nightly two-field log with derived average.',
  },
  {
    id: 'tr-06',
    prompt: 'coffee intake tracker — log each cup through the day, see daily total and weekly trend',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: per-event tap logging with daily and weekly aggregates.',
  },
  {
    id: 'tr-07',
    prompt: 'weight log — enter my weight each morning and see a chart of progress over time',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily single-value log with trend display.',
  },
  {
    id: 'tr-08',
    prompt: 'workout log — record sets, reps, and weight for each exercise each day',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: session-based multi-field log with history.',
  },
  {
    id: 'tr-09',
    prompt: 'medication reminder tracker — mark each pill taken and see my adherence streak',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily check-in with streak display.',
  },
  {
    id: 'tr-10',
    prompt: 'reading tracker — log pages read each day toward a monthly goal',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily numeric input with cumulative goal progress.',
  },
  {
    id: 'tr-11',
    prompt: 'calorie counter — log meals with calorie counts, see today\'s total vs target',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: per-meal logging with daily aggregate and target comparison.',
  },
  {
    id: 'tr-12',
    prompt: 'screen time tracker — log hours of screen time each day and see weekly average',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily single-value log with weekly rollup.',
  },
  {
    id: 'tr-13',
    prompt: 'hydration log — tap a button each time I drink water; see how many times today',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: event-tap counter with daily count display.',
  },
  {
    id: 'tr-14',
    prompt: 'meditation streak app — mark each day I meditate and keep a running streak',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily boolean log with streak counter.',
  },
  {
    id: 'tr-15',
    prompt: 'spending diary — log each purchase amount and category, see daily total',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: per-transaction logging with daily aggregate; no list-level CRUD.',
  },
  {
    id: 'tr-16',
    prompt: 'running log — enter distance and duration after each run, see monthly mileage',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: session-based two-field log with monthly aggregate.',
  },
  {
    id: 'tr-17',
    prompt: 'blood pressure monitor — log systolic and diastolic each morning, see trend',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily two-value health metric log with trend.',
  },
  {
    id: 'tr-18',
    prompt: 'fasting tracker — log start and end time of each fast, see longest streak',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: session start/end log with streak and duration history.',
  },
  {
    id: 'tr-19',
    prompt: 'cold shower habit — tap done each morning after a cold shower, track 30-day streak',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: single daily boolean log with 30-day streak target.',
  },
  {
    id: 'tr-20',
    prompt: 'gratitude streak — log one thing I am grateful for each day, track how many days in a row',
    expected_archetype: 'Tracker',
    label_note: 'Tracker edge/Journal boundary: short-form daily entry with streak emphasis dominates.',
  },
  {
    id: 'tr-21',
    prompt: 'nap tracker — log each nap with start time and duration, see weekly nap count',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: per-session log with weekly count rollup.',
  },
  {
    id: 'tr-22',
    prompt: 'stretch timer tracker — log each stretching session length, see monthly total minutes',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: session-duration log with monthly aggregate.',
  },
  {
    id: 'tr-23',
    prompt: 'outdoor time log — mark each time I go outside, see how often per week',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: event-tap log with weekly frequency view.',
  },
  {
    id: 'tr-24',
    prompt: 'stress level tracker — rate my stress 1-10 each evening, see weekly average',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily 1-10 rating log with weekly average.',
  },
  {
    id: 'tr-25',
    prompt: 'guitar practice log — record minutes practiced each day, track 100-day streak',
    expected_archetype: 'Tracker',
    label_note: 'Tracker: daily duration log with long-form streak target.',
  },

  // --------------------------------------------------------------------------
  // Journal — 25 prompts
  // Pattern: longer-form dated entries; revisit and browse past entries.
  // --------------------------------------------------------------------------
  {
    id: 'jo-01',
    prompt: 'daily journal — write a note each day and browse past entries',
    expected_archetype: 'Journal',
    label_note: 'Journal: free-form text entry dated to a day, entry list.',
  },
  {
    id: 'jo-02',
    prompt: 'gratitude journal app where I write three things I am grateful for each morning',
    expected_archetype: 'Journal',
    label_note: 'Journal: structured daily entries (3 fields), history list.',
  },
  {
    id: 'jo-03',
    prompt: 'dream diary — record dreams right when I wake up and search past dreams',
    expected_archetype: 'Journal',
    label_note: 'Journal: long-form dated entries; search is incidental to journaling core.',
  },
  {
    id: 'jo-04',
    prompt: 'travel journal — write about each day of my trip with notes and impressions',
    expected_archetype: 'Journal',
    label_note: 'Journal: dated free-form narrative entries, browsable history.',
  },
  {
    id: 'jo-05',
    prompt: 'pregnancy journal — write weekly entries about how the pregnancy is going',
    expected_archetype: 'Journal',
    label_note: 'Journal: periodic narrative entries with week-based dating.',
  },
  {
    id: 'jo-06',
    prompt: 'food diary — write what I ate each day with how it made me feel',
    expected_archetype: 'Journal',
    label_note: 'Journal: narrative daily entry with reflective content; not a calorie counter.',
  },
  {
    id: 'jo-07',
    prompt: 'book reflection journal — after finishing a book, write my thoughts and key takeaways',
    expected_archetype: 'Journal',
    label_note: 'Journal: per-book long-form reflection entry.',
  },
  {
    id: 'jo-08',
    prompt: 'parenting journal — record milestones and funny moments for each of my kids',
    expected_archetype: 'Journal',
    label_note: 'Journal: event-triggered narrative entries per child.',
  },
  {
    id: 'jo-09',
    prompt: 'therapy journal — write about my feelings before and after each therapy session',
    expected_archetype: 'Journal',
    label_note: 'Journal: dated reflective entries tied to session events.',
  },
  {
    id: 'jo-10',
    prompt: 'idea capture journal — jot down ideas as they come, revisit and expand later',
    expected_archetype: 'Journal',
    label_note: 'Journal: free-form entry capture with browsing/editing emphasis.',
  },
  {
    id: 'jo-11',
    prompt: 'morning pages app — write three pages of stream-of-consciousness text each morning',
    expected_archetype: 'Journal',
    label_note: 'Journal: daily long-form free-write, history browsable.',
  },
  {
    id: 'jo-12',
    prompt: 'project retrospective journal — write post-mortems after finishing each project',
    expected_archetype: 'Journal',
    label_note: 'Journal: per-project reflective entry with structured fields.',
  },
  {
    id: 'jo-13',
    prompt: 'weekly review journal — write a summary of each week: wins, struggles, next steps',
    expected_archetype: 'Journal',
    label_note: 'Journal: periodic structured entry with reflection fields.',
  },
  {
    id: 'jo-14',
    prompt: 'learning journal — after each online course session write what I learned',
    expected_archetype: 'Journal',
    label_note: 'Journal: session-triggered learning reflection entry.',
  },
  {
    id: 'jo-15',
    prompt: 'anxiety journal — write about triggers and how I coped, review patterns over time',
    expected_archetype: 'Journal',
    label_note: 'Journal: event-triggered reflective entry; pattern-review is browsing history.',
  },
  {
    id: 'jo-16',
    prompt: 'meeting journal — write what happened and decisions made after each meeting',
    expected_archetype: 'Journal',
    label_note: 'Journal: event-triggered narrative entry (meeting recap). Note: lc-14 is meeting notes LIST vs this as narrative recap.',
  },
  {
    id: 'jo-17',
    prompt: 'year-in-review journal — write monthly summaries throughout the year',
    expected_archetype: 'Journal',
    label_note: 'Journal: monthly long-form entry with end-of-year review browsing.',
  },
  {
    id: 'jo-18',
    prompt: 'creative writing journal — write short stories or scenes whenever inspired',
    expected_archetype: 'Journal',
    label_note: 'Journal: open-ended creative text entries with browsing.',
  },
  {
    id: 'jo-19',
    prompt: 'sobriety journal — write daily reflections on my recovery journey',
    expected_archetype: 'Journal',
    label_note: 'Journal: daily reflective narrative entry with browsable history.',
  },
  {
    id: 'jo-20',
    prompt: 'nature observation journal — write about what I see on each walk in the park',
    expected_archetype: 'Journal',
    label_note: 'Journal: outing-triggered descriptive narrative entry.',
  },
  {
    id: 'jo-21',
    prompt: 'diet journal — write a free-form note about what I ate and how I feel after meals',
    expected_archetype: 'Journal',
    label_note: 'Journal: meal-triggered narrative reflection (contrast tr-11 which counts calories).',
  },
  {
    id: 'jo-22',
    prompt: 'reading journal — write thoughts on each chapter as I read a book',
    expected_archetype: 'Journal',
    label_note: 'Journal: chapter-triggered reflective entries, browsable history.',
  },
  {
    id: 'jo-23',
    prompt: 'fitness journal — write about how each workout felt, recovery notes, energy levels',
    expected_archetype: 'Journal',
    label_note: 'Journal: session-triggered narrative (contrast tr-08 which logs sets/reps).',
  },
  {
    id: 'jo-24',
    prompt: 'pet journal — write about funny or memorable moments with my dog',
    expected_archetype: 'Journal',
    label_note: 'Journal: event-triggered narrative entries about pet moments.',
  },
  {
    id: 'jo-25',
    prompt: 'startup journal — write daily about the progress and struggles of building my startup',
    expected_archetype: 'Journal',
    label_note: 'Journal: daily narrative founder log with browsable history.',
  },

  // --------------------------------------------------------------------------
  // Calculator — 25 prompts
  // Pattern: enter inputs, see derived result; single-screen; no persistence.
  // --------------------------------------------------------------------------
  {
    id: 'ca-01',
    prompt: 'tip calculator — enter bill amount and tip percentage, see the total and tip amount',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two numeric inputs, two derived results, no persistence.',
  },
  {
    id: 'ca-02',
    prompt: 'BMI calculator where I enter height and weight and see my BMI and category',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two numeric inputs, one derived result, single screen.',
  },
  {
    id: 'ca-03',
    prompt: 'unit converter for temperature between Celsius and Fahrenheit',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: single transformation, no data persistence required.',
  },
  {
    id: 'ca-04',
    prompt: 'loan repayment calculator — enter principal, rate, and term, see monthly payment',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three financial inputs, one derived monthly payment.',
  },
  {
    id: 'ca-05',
    prompt: 'split bill calculator — enter total amount and number of people, see each person\'s share',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs, one derived result, ephemeral use.',
  },
  {
    id: 'ca-06',
    prompt: 'compound interest calculator — enter principal, rate, years, see final value',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three inputs, one derived result (compounding formula).',
  },
  {
    id: 'ca-07',
    prompt: 'pace calculator for running — enter distance and time, see pace per mile and per km',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs, two derived pace results.',
  },
  {
    id: 'ca-08',
    prompt: 'fuel cost calculator — enter distance, fuel efficiency, and price per litre, see trip cost',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three inputs, one derived cost result.',
  },
  {
    id: 'ca-09',
    prompt: 'currency converter — enter an amount and select currencies, see the converted value',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: amount + two-picker inputs, one derived result.',
  },
  {
    id: 'ca-10',
    prompt: 'calorie burn estimator — enter activity, duration, and weight, see calories burned',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three inputs, one derived result (no logging = not Tracker).',
  },
  {
    id: 'ca-11',
    prompt: 'discount price calculator — enter original price and discount percentage, see final price',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs, one derived result.',
  },
  {
    id: 'ca-12',
    prompt: 'age calculator — enter birthdate, see exact age in years, months, and days',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: one date input, three derived outputs.',
  },
  {
    id: 'ca-13',
    prompt: 'concrete mix calculator — enter area and thickness, see how many bags of concrete to buy',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two measurement inputs, one derived supply quantity.',
  },
  {
    id: 'ca-14',
    prompt: 'retirement savings calculator — enter current age, retirement age, monthly savings, see projected balance',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three financial inputs, one projected-balance output.',
  },
  {
    id: 'ca-15',
    prompt: 'unit price calculator — enter total price and quantity, see price per unit',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs, one derived unit price.',
  },
  {
    id: 'ca-16',
    prompt: 'cooking measurement converter — enter a quantity in cups and see it in millilitres and tablespoons',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: one numeric input, multiple unit conversions.',
  },
  {
    id: 'ca-17',
    prompt: 'grade average calculator — enter subject grades and weights, see weighted GPA',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: multi-row inputs, one derived weighted average.',
  },
  {
    id: 'ca-18',
    prompt: 'protein intake calculator — enter body weight and activity level, see daily protein target',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs (one enum picker), one derived target.',
  },
  {
    id: 'ca-19',
    prompt: 'paint coverage calculator — enter room dimensions, see litres of paint needed',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: measurement inputs, one derived coverage quantity.',
  },
  {
    id: 'ca-20',
    prompt: 'time zone converter — enter a time in one city, see what time it is in another',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: time + city inputs, one derived time result.',
  },
  {
    id: 'ca-21',
    prompt: 'heart rate zone calculator — enter max heart rate, see five training zones',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: one input, five derived zone outputs.',
  },
  {
    id: 'ca-22',
    prompt: 'download speed estimator — enter file size and connection speed, see download time',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs, one derived duration.',
  },
  {
    id: 'ca-23',
    prompt: 'flooring area calculator — enter room length and width, see square footage and tiles needed',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two measurement inputs, two derived quantities.',
  },
  {
    id: 'ca-24',
    prompt: 'tax calculator — enter income and filing status, see estimated federal tax owed',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: two inputs (one picker), one derived tax amount.',
  },
  {
    id: 'ca-25',
    prompt: 'break-even calculator — enter fixed costs, variable cost per unit, and unit price, see break-even quantity',
    expected_archetype: 'Calculator',
    label_note: 'Calculator: three business inputs, one derived break-even quantity.',
  },
]

// ---------------------------------------------------------------------------
// OUT_OF_SCOPE_DETECTION_PROMPTS — 30 prompts, 6 per capability
// Each prompt unambiguously invokes an out-of-scope capability.
// No 'unknown' in this set (T-0007-157).
// ---------------------------------------------------------------------------

export const OUT_OF_SCOPE_DETECTION_PROMPTS: DetectionEntry[] = [
  // --------------------------------------------------------------------------
  // image_gen — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'det-ig-01',
    prompt: 'generate a portrait of a cat wearing a cowboy hat',
    expected_capability: 'image_gen',
    label_note: 'image_gen: explicit text-to-image generation request.',
  },
  {
    id: 'det-ig-02',
    prompt: 'create AI artwork of a sunset over the ocean in watercolour style',
    expected_capability: 'image_gen',
    label_note: 'image_gen: style-guided image generation.',
  },
  {
    id: 'det-ig-03',
    prompt: 'make a logo for my bakery using AI — sourdough bread, rustic style',
    expected_capability: 'image_gen',
    label_note: 'image_gen: brand asset generation from text description.',
  },
  {
    id: 'det-ig-04',
    prompt: 'generate product photos for my Etsy shop based on my product descriptions',
    expected_capability: 'image_gen',
    label_note: 'image_gen: commercial image generation from text.',
  },
  {
    id: 'det-ig-05',
    prompt: 'draw a cartoon avatar of me based on my appearance description',
    expected_capability: 'image_gen',
    label_note: 'image_gen: avatar/portrait generation from description.',
  },
  {
    id: 'det-ig-06',
    prompt: 'create concept art for my game character — elf rogue, dark forest setting',
    expected_capability: 'image_gen',
    label_note: 'image_gen: game concept art generation.',
  },

  // --------------------------------------------------------------------------
  // vision — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'det-vi-01',
    prompt: 'identify what plant this is from a photo I take',
    expected_capability: 'vision',
    label_note: 'vision: photo-to-classification (plant identification).',
  },
  {
    id: 'det-vi-02',
    prompt: 'scan my receipt and automatically extract the items and prices',
    expected_capability: 'vision',
    label_note: 'vision: document scan + OCR extraction.',
  },
  {
    id: 'det-vi-03',
    prompt: 'take a photo of my meal and tell me the approximate calorie count',
    expected_capability: 'vision',
    label_note: 'vision: food photo → nutrition analysis.',
  },
  {
    id: 'det-vi-04',
    prompt: 'point my camera at a math problem and solve it',
    expected_capability: 'vision',
    label_note: 'vision: camera input → math solution (visual reasoning).',
  },
  {
    id: 'det-vi-05',
    prompt: 'read the text on this sign in a foreign language using my camera',
    expected_capability: 'vision',
    label_note: 'vision: live camera OCR + translation.',
  },
  {
    id: 'det-vi-06',
    prompt: 'analyze my skin condition from a selfie and suggest care routines',
    expected_capability: 'vision',
    label_note: 'vision: medical-style photo analysis.',
  },

  // --------------------------------------------------------------------------
  // chat — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'det-ch-01',
    prompt: 'a chat app where I can talk to an AI therapist',
    expected_capability: 'chat',
    label_note: 'chat: conversational AI back-and-forth.',
  },
  {
    id: 'det-ch-02',
    prompt: 'real-time messaging app to talk with my friends',
    expected_capability: 'chat',
    label_note: 'chat: multi-user conversational messaging.',
  },
  {
    id: 'det-ch-03',
    prompt: 'AI tutor that answers my questions about algebra in a conversation',
    expected_capability: 'chat',
    label_note: 'chat: multi-turn question-and-answer tutoring.',
  },
  {
    id: 'det-ch-04',
    prompt: 'customer support chatbot for my e-commerce store',
    expected_capability: 'chat',
    label_note: 'chat: conversational support bot.',
  },
  {
    id: 'det-ch-05',
    prompt: 'interactive storytelling where the AI responds to my choices and continues the story',
    expected_capability: 'chat',
    label_note: 'chat: multi-turn narrative conversation.',
  },
  {
    id: 'det-ch-06',
    prompt: 'an app to debate any topic with an AI that argues the opposite side',
    expected_capability: 'chat',
    label_note: 'chat: multi-turn adversarial conversational AI.',
  },

  // --------------------------------------------------------------------------
  // transcription — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'det-tr-01',
    prompt: 'transcribe my voice memos into text automatically',
    expected_capability: 'transcription',
    label_note: 'transcription: audio-to-text voice memo conversion.',
  },
  {
    id: 'det-tr-02',
    prompt: 'record a meeting and get a transcript of everything said',
    expected_capability: 'transcription',
    label_note: 'transcription: live meeting audio → text transcript.',
  },
  {
    id: 'det-tr-03',
    prompt: 'dictate my diary entries by speaking and have them transcribed',
    expected_capability: 'transcription',
    label_note: 'transcription: speech-to-text dictation for entries.',
  },
  {
    id: 'det-tr-04',
    prompt: 'upload a podcast episode and get a searchable transcript',
    expected_capability: 'transcription',
    label_note: 'transcription: audio file → searchable text.',
  },
  {
    id: 'det-tr-05',
    prompt: 'voice-to-text note-taking app — speak and see your words appear',
    expected_capability: 'transcription',
    label_note: 'transcription: real-time speech recognition display.',
  },
  {
    id: 'det-tr-06',
    prompt: 'transcribe court hearing recordings into formatted legal transcripts',
    expected_capability: 'transcription',
    label_note: 'transcription: domain-specific audio transcription.',
  },

  // --------------------------------------------------------------------------
  // classification — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'det-cl-01',
    prompt: 'classify my emails as spam, promotions, or important automatically',
    expected_capability: 'classification',
    label_note: 'classification: ML-based email triage.',
  },
  {
    id: 'det-cl-02',
    prompt: 'AI that reads my transactions and categorises them as food, rent, entertainment',
    expected_capability: 'classification',
    label_note: 'classification: transaction auto-categorisation.',
  },
  {
    id: 'det-cl-03',
    prompt: 'detect whether a product review is positive, negative, or neutral',
    expected_capability: 'classification',
    label_note: 'classification: sentiment analysis on text input.',
  },
  {
    id: 'det-cl-04',
    prompt: 'sort my photos into categories like nature, food, people, and travel using AI',
    expected_capability: 'classification',
    label_note: 'classification: image classification into topic categories.',
  },
  {
    id: 'det-cl-05',
    prompt: 'detect if a news headline is clickbait or genuine',
    expected_capability: 'classification',
    label_note: 'classification: binary text classification on news content.',
  },
  {
    id: 'det-cl-06',
    prompt: 'score job applications and rank candidates by fit for the role',
    expected_capability: 'classification',
    label_note: 'classification: document scoring/ranking (ML-based fit score).',
  },
]

// ---------------------------------------------------------------------------
// OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS — 30 in-scope prompts that brush against
// out-of-scope capabilities but should produce a valid app spec.
// Each has expected_archetype + brushes_against (T-0007-159).
// ---------------------------------------------------------------------------

export const OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS: FalsePositiveEntry[] = [
  // --------------------------------------------------------------------------
  // Brushes against image_gen — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'fp-ig-01',
    prompt: 'photo album app — organise my existing saved photos into named albums',
    expected_archetype: 'ListCRUD',
    brushes_against: 'image_gen',
    label_note: 'Organising existing photos (ListCRUD), not generating new ones.',
  },
  {
    id: 'fp-ig-02',
    prompt: 'art project tracker — log each artwork I complete with title, medium, and date',
    expected_archetype: 'Tracker',
    brushes_against: 'image_gen',
    label_note: 'Tracking completed artworks (Tracker), not generating images.',
  },
  {
    id: 'fp-ig-03',
    prompt: 'mood board list — save reference image URLs with notes about why I like them',
    expected_archetype: 'ListCRUD',
    brushes_against: 'image_gen',
    label_note: 'Saving external image URLs (ListCRUD), not generating images.',
  },
  {
    id: 'fp-ig-04',
    prompt: 'photography journal — write notes about each shoot: location, settings, what worked',
    expected_archetype: 'Journal',
    brushes_against: 'image_gen',
    label_note: 'Narrative photography notes (Journal), not image generation.',
  },
  {
    id: 'fp-ig-05',
    prompt: 'design inspiration log — jot down design ideas with color codes and sketching notes',
    expected_archetype: 'Journal',
    brushes_against: 'image_gen',
    label_note: 'Text-based design idea capture (Journal), not generating images.',
  },
  {
    id: 'fp-ig-06',
    prompt: 'canvas size calculator — enter dimensions in inches, see pixel size at various DPI',
    expected_archetype: 'Calculator',
    brushes_against: 'image_gen',
    label_note: 'Pixel arithmetic (Calculator), not image generation.',
  },

  // --------------------------------------------------------------------------
  // Brushes against vision — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'fp-vi-01',
    prompt: 'plant care tracker — log each watering for my named plants, see which are overdue',
    expected_archetype: 'Tracker',
    brushes_against: 'vision',
    label_note: 'Watering log (Tracker), not plant identification via camera.',
  },
  {
    id: 'fp-vi-02',
    prompt: 'receipt expense tracker — manually enter amounts from receipts by category',
    expected_archetype: 'Tracker',
    brushes_against: 'vision',
    label_note: 'Manual expense logging (Tracker), not scanning receipts.',
  },
  {
    id: 'fp-vi-03',
    prompt: 'calorie log — manually type the calories of each meal I eat',
    expected_archetype: 'Tracker',
    brushes_against: 'vision',
    label_note: 'Manual calorie entry (Tracker), not photo-based calorie detection.',
  },
  {
    id: 'fp-vi-04',
    prompt: 'skin care routine tracker — log morning and evening routines, track streak',
    expected_archetype: 'Tracker',
    brushes_against: 'vision',
    label_note: 'Routine logging (Tracker), not skin photo analysis.',
  },
  {
    id: 'fp-vi-05',
    prompt: 'plant identification journal — write notes about plants I find on walks with name and location',
    expected_archetype: 'Journal',
    brushes_against: 'vision',
    label_note: 'Textual plant observation notes (Journal), not AI photo identification.',
  },
  {
    id: 'fp-vi-06',
    prompt: 'field-of-view calculator — enter focal length and sensor size, see angle of view',
    expected_archetype: 'Calculator',
    brushes_against: 'vision',
    label_note: 'Optics formula (Calculator), not computer vision.',
  },

  // --------------------------------------------------------------------------
  // Brushes against chat — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'fp-ch-01',
    prompt: 'conversation log — record key points from each important conversation I have',
    expected_archetype: 'Journal',
    brushes_against: 'chat',
    label_note: 'Human notes about conversations (Journal), not an AI chat interface.',
  },
  {
    id: 'fp-ch-02',
    prompt: 'language learning vocabulary list — add words with translations and example sentences',
    expected_archetype: 'ListCRUD',
    brushes_against: 'chat',
    label_note: 'Vocabulary CRUD (ListCRUD), not an AI conversation partner.',
  },
  {
    id: 'fp-ch-03',
    prompt: 'interview prep tracker — log each practice question I studied and whether I answered well',
    expected_archetype: 'Tracker',
    brushes_against: 'chat',
    label_note: 'Self-study logging (Tracker), not an interactive AI interview.',
  },
  {
    id: 'fp-ch-04',
    prompt: 'debate argument builder — list pro and con arguments for a topic, add new ones',
    expected_archetype: 'ListCRUD',
    brushes_against: 'chat',
    label_note: 'Argument CRUD list (ListCRUD), not a conversational AI debate.',
  },
  {
    id: 'fp-ch-05',
    prompt: 'meeting agenda planner — add agenda items with time estimates, reorder before meetings',
    expected_archetype: 'ListCRUD',
    brushes_against: 'chat',
    label_note: 'Agenda item management (ListCRUD), not a meeting chatbot.',
  },
  {
    id: 'fp-ch-06',
    prompt: 'words-per-minute calculator — enter word count and reading time, see WPM',
    expected_archetype: 'Calculator',
    brushes_against: 'chat',
    label_note: 'Simple division formula (Calculator), not a conversational AI.',
  },

  // --------------------------------------------------------------------------
  // Brushes against transcription — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'fp-tr-01',
    prompt: 'lecture notes list — add bullet-point notes from each class manually',
    expected_archetype: 'ListCRUD',
    brushes_against: 'transcription',
    label_note: 'Manual note CRUD (ListCRUD), not audio transcription.',
  },
  {
    id: 'fp-tr-02',
    prompt: 'podcast episode tracker — log episodes I have listened to with rating',
    expected_archetype: 'Tracker',
    brushes_against: 'transcription',
    label_note: 'Episode log (Tracker), not transcription of audio.',
  },
  {
    id: 'fp-tr-03',
    prompt: 'meeting action items list — write down action items from meetings, assign and check off',
    expected_archetype: 'ListCRUD',
    brushes_against: 'transcription',
    label_note: 'Manual action item CRUD (ListCRUD), not meeting audio transcription.',
  },
  {
    id: 'fp-tr-04',
    prompt: 'interview notes journal — write free-form notes during or after each candidate interview',
    expected_archetype: 'Journal',
    brushes_against: 'transcription',
    label_note: 'Manually written interview notes (Journal), not voice transcription.',
  },
  {
    id: 'fp-tr-05',
    prompt: 'voice memo log — record the title, date, and topic of each voice memo I make manually',
    expected_archetype: 'ListCRUD',
    brushes_against: 'transcription',
    label_note: 'Metadata CRUD about memos (ListCRUD), not transcribing the audio.',
  },
  {
    id: 'fp-tr-06',
    prompt: 'words typed per day tracker — log how many words I wrote each day as a productivity metric',
    expected_archetype: 'Tracker',
    brushes_against: 'transcription',
    label_note: 'Typing metric log (Tracker), not speech transcription.',
  },

  // --------------------------------------------------------------------------
  // Brushes against classification — 6 prompts
  // --------------------------------------------------------------------------
  {
    id: 'fp-cl-01',
    prompt: 'expense categoriser — manually tag each expense as food, rent, or fun',
    expected_archetype: 'ListCRUD',
    brushes_against: 'classification',
    label_note: 'Human-assigned category CRUD (ListCRUD), not AI auto-classification.',
  },
  {
    id: 'fp-cl-02',
    prompt: 'task priority sorter — list tasks and manually drag them into high/medium/low buckets',
    expected_archetype: 'ListCRUD',
    brushes_against: 'classification',
    label_note: 'Manual priority CRUD (ListCRUD), not ML-based task scoring.',
  },
  {
    id: 'fp-cl-03',
    prompt: 'personal scoring tracker — rate my productivity each day on a 1-10 scale',
    expected_archetype: 'Tracker',
    brushes_against: 'classification',
    label_note: 'Self-scored daily metric (Tracker), not AI classification.',
  },
  {
    id: 'fp-cl-04',
    prompt: 'book genre list — add books and manually assign them a genre tag',
    expected_archetype: 'ListCRUD',
    brushes_against: 'classification',
    label_note: 'Manual genre tagging CRUD (ListCRUD), not AI genre detection.',
  },
  {
    id: 'fp-cl-05',
    prompt: 'product feedback journal — write notes on user reactions to each feature I ship',
    expected_archetype: 'Journal',
    brushes_against: 'classification',
    label_note: 'Narrative product feedback notes (Journal), not sentiment classification.',
  },
  {
    id: 'fp-cl-06',
    prompt: 'risk score calculator — enter likelihood and impact scores, see overall risk rating',
    expected_archetype: 'Calculator',
    brushes_against: 'classification',
    label_note: 'Manual risk matrix formula (Calculator), not AI risk classification.',
  },
]

// ---------------------------------------------------------------------------
// V1_ARCHETYPE_PROMPTS — 60 V1-exercising prompts, 15 per archetype.
// ADR-0009 Step 10. Each prompt targets at least one V1 component.
// Target components noted inline for traceability. T-0009-221, T-0009-222.
// Pass-rate gate: ≥75% per archetype (run against live LLM in CI eval).
// ---------------------------------------------------------------------------

export type V1PromptEntry = {
  id: string
  prompt: string
  expected_archetype: V0Archetype
  target_v1_components: string[]
  label_note: string
}

export const V1_ARCHETYPE_PROMPTS: V1PromptEntry[] = [
  // --------------------------------------------------------------------------
  // V1 ListCRUD — 15 prompts
  // Each exercises at least one V1 component in a list-management context.
  // --------------------------------------------------------------------------
  {
    id: 'v1-lc-01',
    prompt: 'expense tracker — add purchases with merchant name, amount, and category; browse and delete',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['TransactionRow', 'MoneyField'],
    label_note: 'ListCRUD: financial records → TransactionRow for rows; MoneyField for amount entry.',
  },
  {
    id: 'v1-lc-02',
    prompt: 'product catalog app — list products with photo, name, and price; add and delete items',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['CommerceCard', 'Image'],
    label_note: 'ListCRUD: product records → CommerceCard or Image for product photo.',
  },
  {
    id: 'v1-lc-03',
    prompt: 'recipe book with step-by-step instructions — save recipes with ingredients list and ordered steps',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['StepList', 'Image'],
    label_note: 'ListCRUD: recipe records with StepList for ordered steps; Image for recipe photo.',
  },
  {
    id: 'v1-lc-04',
    prompt: 'contact directory — manage a list of people with photo, name, and tags for their role',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['AvatarGroup', 'SearchBar', 'MultiPicker'],
    label_note: 'ListCRUD: contact records; SearchBar for filtering; MultiPicker for role tags.',
  },
  {
    id: 'v1-lc-05',
    prompt: 'task list with star ratings for priority — add tasks, rate importance 1-5, delete done ones',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['RatingInput'],
    label_note: 'ListCRUD: task records with RatingInput for priority star rating.',
  },
  {
    id: 'v1-lc-06',
    prompt: 'plant collection app — add plants with a photo, care notes, and watering schedule; browse and delete',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['Image', 'TimeField'],
    label_note: 'ListCRUD: plant records; Image for plant photo; TimeField for watering time.',
  },
  {
    id: 'v1-lc-07',
    prompt: 'document library — add files with title and type, pick from device storage, delete old ones',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['DocumentPicker'],
    label_note: 'ListCRUD: document records; DocumentPicker to attach files.',
  },
  {
    id: 'v1-lc-08',
    prompt: 'investment portfolio — add holdings with ticker, amount invested, and currency; browse and delete',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['MoneyField', 'Divider'],
    label_note: 'ListCRUD: holding records; MoneyField for invested amount; Divider between sections.',
  },
  {
    id: 'v1-lc-09',
    prompt: 'team skills board — add team members with photo and select their skills from a multi-pick list',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['MultiPicker', 'AvatarGroup'],
    label_note: 'ListCRUD: member records; MultiPicker for skill tags; AvatarGroup for team overview.',
  },
  {
    id: 'v1-lc-10',
    prompt: 'wine collection — add bottles with photo, vintage, variety, and price; mark opened',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['Image', 'MoneyField', 'GridList'],
    label_note: 'ListCRUD: bottle records; Image for label photo; MoneyField for price; GridList for grid browse.',
  },
  {
    id: 'v1-lc-11',
    prompt: 'appointment book — add appointments with doctor name, date, time, and fee; browse by date',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['TimeField', 'MoneyField', 'Timeline'],
    label_note: 'ListCRUD: appointment records; TimeField for appointment time; MoneyField for fee; Timeline for date-ordered list.',
  },
  {
    id: 'v1-lc-12',
    prompt: 'travel photo album — add trips with name and photos; browse photos in a grid',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['Gallery', 'Image'],
    label_note: 'ListCRUD: trip records; Gallery for photo grid on detail screen.',
  },
  {
    id: 'v1-lc-13',
    prompt: 'event planner — add events with description, ticket price, and start time; filter by category',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['TimeField', 'MoneyField', 'SearchBar', 'MultiPicker'],
    label_note: 'ListCRUD: event records; TimeField + MoneyField for event meta; SearchBar/MultiPicker for filter.',
  },
  {
    id: 'v1-lc-14',
    prompt: 'subscription manager — add subscriptions with cost, billing date, and renewal interval; see total spend',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['MoneyField', 'MetricTile', 'Divider'],
    label_note: 'ListCRUD: subscription records; MoneyField for cost; MetricTile for total spend; Divider between groups.',
  },
  {
    id: 'v1-lc-15',
    prompt: 'medication list — add medications with name, dosage, and daily time reminders; mark taken',
    expected_archetype: 'ListCRUD',
    target_v1_components: ['TimeField', 'Callout'],
    label_note: 'ListCRUD: medication records; TimeField for dosage time; Callout for missed-dose warning.',
  },

  // --------------------------------------------------------------------------
  // V1 Tracker — 15 prompts
  // Each exercises at least one V1 component in a repeated-logging context.
  // --------------------------------------------------------------------------
  {
    id: 'v1-tr-01',
    prompt: 'habit tracker with a heatmap showing my consistency over the last 90 days',
    expected_archetype: 'Tracker',
    target_v1_components: ['Heatmap'],
    label_note: 'Tracker: daily habit log; Heatmap for 90-day density view.',
  },
  {
    id: 'v1-tr-02',
    prompt: 'daily expense diary — log each purchase amount and category, see this month\'s spending total',
    expected_archetype: 'Tracker',
    target_v1_components: ['MoneyField', 'TransactionRow', 'MetricTile'],
    label_note: 'Tracker: per-purchase log; MoneyField for amount; TransactionRow for rows; MetricTile for monthly total.',
  },
  {
    id: 'v1-tr-03',
    prompt: 'mood tracker where I rate my mood each day with stars and see my weekly average mood',
    expected_archetype: 'Tracker',
    target_v1_components: ['RatingInput', 'MetricTile'],
    label_note: 'Tracker: daily star-rating log; RatingInput for mood; MetricTile for weekly average.',
  },
  {
    id: 'v1-tr-04',
    prompt: 'workout log — log exercises with sets, reps, and weight; see a calendar of workout days',
    expected_archetype: 'Tracker',
    target_v1_components: ['Calendar', 'Divider'],
    label_note: 'Tracker: workout session log; Calendar to see active days; Divider between days.',
  },
  {
    id: 'v1-tr-05',
    prompt: 'sleep tracker — log bedtime and wake time each night using a time picker',
    expected_archetype: 'Tracker',
    target_v1_components: ['TimeField', 'MetricTile'],
    label_note: 'Tracker: nightly log; TimeField for bedtime/wake; MetricTile for average duration.',
  },
  {
    id: 'v1-tr-06',
    prompt: 'water intake tracker — log each glass with a slider for ounces, see daily total',
    expected_archetype: 'Tracker',
    target_v1_components: ['Slider', 'MetricTile'],
    label_note: 'Tracker: per-glass log; Slider for ounce amount; MetricTile for daily total.',
  },
  {
    id: 'v1-tr-07',
    prompt: 'savings tracker — log each deposit to my savings goal; see how much I have saved with a sparkline trend',
    expected_archetype: 'Tracker',
    target_v1_components: ['MoneyField', 'MetricTile'],
    label_note: 'Tracker: deposit log; MoneyField for amount; MetricTile with sparkline for total savings trend.',
  },
  {
    id: 'v1-tr-08',
    prompt: 'reading tracker — log minutes read per day and see a heatmap of reading streaks',
    expected_archetype: 'Tracker',
    target_v1_components: ['Heatmap', 'Slider'],
    label_note: 'Tracker: daily reading log; Heatmap for streak visualization; Slider for minutes input.',
  },
  {
    id: 'v1-tr-09',
    prompt: 'pain level tracker — rate pain 1-10 twice a day; see a calendar marked with high-pain days',
    expected_archetype: 'Tracker',
    target_v1_components: ['RatingInput', 'Calendar'],
    label_note: 'Tracker: pain log; RatingInput for level; Calendar for day-level view.',
  },
  {
    id: 'v1-tr-10',
    prompt: 'fitness photo progress tracker — log a weekly photo and see a before/after comparison of first and latest',
    expected_archetype: 'Tracker',
    target_v1_components: ['BeforeAfter', 'Image'],
    label_note: 'Tracker: weekly photo log; BeforeAfter for first-vs-latest comparison.',
  },
  {
    id: 'v1-tr-11',
    prompt: 'nutrition tracker — log meals with calorie and macro counts using sliders; see daily totals',
    expected_archetype: 'Tracker',
    target_v1_components: ['Slider', 'MetricTile', 'Divider'],
    label_note: 'Tracker: meal log; Slider for macros; MetricTile for daily totals; Divider between meal groups.',
  },
  {
    id: 'v1-tr-12',
    prompt: 'study session tracker — log study minutes per subject; see a heatmap of study days',
    expected_archetype: 'Tracker',
    target_v1_components: ['Heatmap', 'MultiPicker'],
    label_note: 'Tracker: study log; Heatmap for session density; MultiPicker for subject filter.',
  },
  {
    id: 'v1-tr-13',
    prompt: 'gift budget tracker — log gift purchases with amount and recipient; see total spent',
    expected_archetype: 'Tracker',
    target_v1_components: ['MoneyField', 'TransactionRow', 'Receipt'],
    label_note: 'Tracker: gift purchase log; MoneyField for amount; TransactionRow for entries; Receipt for total.',
  },
  {
    id: 'v1-tr-14',
    prompt: 'medication adherence tracker — log each dose time; see a calendar of adherence',
    expected_archetype: 'Tracker',
    target_v1_components: ['TimeField', 'Calendar', 'Callout'],
    label_note: 'Tracker: dose log; TimeField for time; Calendar for adherence view; Callout for missed-dose alert.',
  },
  {
    id: 'v1-tr-15',
    prompt: 'productivity tracker — rate each day 1-5 stars and tag with focus areas; see monthly heatmap',
    expected_archetype: 'Tracker',
    target_v1_components: ['RatingInput', 'MultiPicker', 'Heatmap'],
    label_note: 'Tracker: daily rating log; RatingInput for score; MultiPicker for focus tags; Heatmap for month view.',
  },

  // --------------------------------------------------------------------------
  // V1 Journal — 15 prompts
  // Each exercises at least one V1 component in a narrative-entry context.
  // --------------------------------------------------------------------------
  {
    id: 'v1-jo-01',
    prompt: 'travel journal with photos — write about each day of my trip and attach a photo',
    expected_archetype: 'Journal',
    target_v1_components: ['Image', 'Gallery'],
    label_note: 'Journal: dated narrative entries; Image per entry; Gallery for all trip photos.',
  },
  {
    id: 'v1-jo-02',
    prompt: 'food journal — write what I ate and rate the meal with stars',
    expected_archetype: 'Journal',
    target_v1_components: ['RatingInput'],
    label_note: 'Journal: meal narrative entries with RatingInput for satisfaction rating.',
  },
  {
    id: 'v1-jo-03',
    prompt: 'dream diary — record dreams with images I attach; browse and search past entries',
    expected_archetype: 'Journal',
    target_v1_components: ['Image', 'SearchBar'],
    label_note: 'Journal: dated dream entries; Image attachment; SearchBar for entry search.',
  },
  {
    id: 'v1-jo-04',
    prompt: 'recovery journal — write daily reflections and tag each entry with my mood category',
    expected_archetype: 'Journal',
    target_v1_components: ['MultiPicker', 'Timeline'],
    label_note: 'Journal: daily reflective entries; MultiPicker for mood tags; Timeline for chronological browse.',
  },
  {
    id: 'v1-jo-05',
    prompt: 'concert journal — write about each show I attend, attach a photo, and rate it',
    expected_archetype: 'Journal',
    target_v1_components: ['Image', 'RatingInput', 'Carousel'],
    label_note: 'Journal: concert entries; Image for show photo; RatingInput for rating; Carousel for photo highlights.',
  },
  {
    id: 'v1-jo-06',
    prompt: 'home renovation journal — document each project phase with before and after photos',
    expected_archetype: 'Journal',
    target_v1_components: ['BeforeAfter', 'Image'],
    label_note: 'Journal: renovation phase entries; BeforeAfter for progress comparison.',
  },
  {
    id: 'v1-jo-07',
    prompt: 'learning journal — write about each course session; tag subjects with a multi-select',
    expected_archetype: 'Journal',
    target_v1_components: ['MultiPicker', 'Callout'],
    label_note: 'Journal: session entries; MultiPicker for subject tags; Callout for key-insight highlight.',
  },
  {
    id: 'v1-jo-08',
    prompt: 'recipe development journal — document recipe experiments with photos and a step list',
    expected_archetype: 'Journal',
    target_v1_components: ['Image', 'StepList', 'Divider'],
    label_note: 'Journal: recipe experiment entries; Image for dish photo; StepList for method steps.',
  },
  {
    id: 'v1-jo-09',
    prompt: 'project retrospective journal — write post-mortems with file attachments for deliverables',
    expected_archetype: 'Journal',
    target_v1_components: ['DocumentPicker', 'Callout'],
    label_note: 'Journal: retrospective entries; DocumentPicker for deliverable files; Callout for action items.',
  },
  {
    id: 'v1-jo-10',
    prompt: 'gratitude journal with a photo — write what I am grateful for and attach an inspiring image',
    expected_archetype: 'Journal',
    target_v1_components: ['Image', 'Divider'],
    label_note: 'Journal: daily gratitude entries; Image for photo; Divider between date sections.',
  },
  {
    id: 'v1-jo-11',
    prompt: 'skin care journal — document my routine with product names and before/after skin photos',
    expected_archetype: 'Journal',
    target_v1_components: ['BeforeAfter', 'StepList'],
    label_note: 'Journal: routine entries; BeforeAfter for skin comparison; StepList for routine steps.',
  },
  {
    id: 'v1-jo-12',
    prompt: 'book notes journal — after each book write key ideas and rate it; browse by a timeline',
    expected_archetype: 'Journal',
    target_v1_components: ['RatingInput', 'Timeline'],
    label_note: 'Journal: per-book reflection entries; RatingInput for rating; Timeline for chronological view.',
  },
  {
    id: 'v1-jo-13',
    prompt: 'nature journal — write about each walk with species observations; attach a photo gallery',
    expected_archetype: 'Journal',
    target_v1_components: ['Gallery', 'SearchBar'],
    label_note: 'Journal: outing entries; Gallery for observation photos; SearchBar for species search.',
  },
  {
    id: 'v1-jo-14',
    prompt: 'birth story journal — write about each stage of labor and delivery with a step-by-step timeline',
    expected_archetype: 'Journal',
    target_v1_components: ['Timeline', 'Image'],
    label_note: 'Journal: narrative entries; Timeline for stage-by-stage view; Image for milestone photos.',
  },
  {
    id: 'v1-jo-15',
    prompt: 'startup journal — write daily entries, rate my energy level, and tag with strategic themes',
    expected_archetype: 'Journal',
    target_v1_components: ['RatingInput', 'MultiPicker', 'Callout'],
    label_note: 'Journal: daily founder entries; RatingInput for energy; MultiPicker for themes; Callout for alerts.',
  },

  // --------------------------------------------------------------------------
  // V1 Calculator — 15 prompts
  // Each exercises at least one V1 component in a computation context.
  // --------------------------------------------------------------------------
  {
    id: 'v1-ca-01',
    prompt: 'tip calculator with a receipt breakdown showing subtotal, tax, tip, and total per person',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Receipt'],
    label_note: 'Calculator: tip inputs; MoneyField for bill; Receipt for itemized breakdown.',
  },
  {
    id: 'v1-ca-02',
    prompt: 'grocery budget calculator — enter item prices with a money field, see total and remaining budget',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'MetricTile'],
    label_note: 'Calculator: item prices via MoneyField; MetricTile for total spend and budget remaining.',
  },
  {
    id: 'v1-ca-03',
    prompt: 'freelance rate calculator — enter hourly rate and hours; see project total and monthly income target',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'MetricTile', 'Divider'],
    label_note: 'Calculator: MoneyField for rate; MetricTile for income projections; Divider between input/output.',
  },
  {
    id: 'v1-ca-04',
    prompt: 'paint cost estimator — enter room dimensions with sliders, see paint quantity and cost',
    expected_archetype: 'Calculator',
    target_v1_components: ['Slider', 'MoneyField', 'MetricTile'],
    label_note: 'Calculator: Slider for dimensions; MoneyField for paint price; MetricTile for total cost.',
  },
  {
    id: 'v1-ca-05',
    prompt: 'mortgage affordability calculator — enter income, expenses, and down payment; see max home price',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'MetricTile', 'Callout'],
    label_note: 'Calculator: MoneyField for financial inputs; MetricTile for max price; Callout for guidance tip.',
  },
  {
    id: 'v1-ca-06',
    prompt: 'event cost splitter — enter total event cost and split equally; show a receipt-style summary',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Receipt'],
    label_note: 'Calculator: MoneyField for event cost; Receipt for per-person itemized split.',
  },
  {
    id: 'v1-ca-07',
    prompt: 'investment return calculator — enter principal, rate slider, and years; see projected value',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'MetricTile'],
    label_note: 'Calculator: MoneyField for principal; Slider for rate; MetricTile for projected value.',
  },
  {
    id: 'v1-ca-08',
    prompt: 'catering cost calculator — enter per-head cost and headcount with a slider; see total and tax',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'Receipt'],
    label_note: 'Calculator: MoneyField for per-head; Slider for count; Receipt for total with tax.',
  },
  {
    id: 'v1-ca-09',
    prompt: 'hourly time tracker and invoice calculator — enter time worked and rate; see invoice total',
    expected_archetype: 'Calculator',
    target_v1_components: ['TimeField', 'MoneyField', 'Receipt'],
    label_note: 'Calculator: TimeField for hours; MoneyField for rate; Receipt for invoice breakdown.',
  },
  {
    id: 'v1-ca-10',
    prompt: 'ingredient cost calculator — enter ingredient costs; see recipe total and per-serving cost',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'MetricTile'],
    label_note: 'Calculator: MoneyField for ingredient prices; Slider for servings; MetricTile for cost per serving.',
  },
  {
    id: 'v1-ca-11',
    prompt: 'electricity cost calculator — enter wattage slider and usage hours; see monthly cost',
    expected_archetype: 'Calculator',
    target_v1_components: ['Slider', 'MoneyField', 'MetricTile'],
    label_note: 'Calculator: Slider for wattage; MoneyField for unit rate; MetricTile for monthly cost.',
  },
  {
    id: 'v1-ca-12',
    prompt: 'discount and tax calculator — enter original price, discount percent, and tax rate; see final price',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'Receipt'],
    label_note: 'Calculator: MoneyField for price; Slider for discount/tax percent; Receipt for breakdown.',
  },
  {
    id: 'v1-ca-13',
    prompt: 'donation impact calculator — enter donation amount, see how many meals that provides',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'MetricTile', 'Callout'],
    label_note: 'Calculator: MoneyField for donation; MetricTile for impact; Callout for thank-you note.',
  },
  {
    id: 'v1-ca-14',
    prompt: 'salary negotiation calculator — enter base, bonus slider, and equity; see total comp and tax estimate',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'Receipt'],
    label_note: 'Calculator: MoneyField for base/equity; Slider for bonus; Receipt for total comp breakdown.',
  },
  {
    id: 'v1-ca-15',
    prompt: 'trip budget planner — enter daily budget and trip length with a slider; see itemized spend plan',
    expected_archetype: 'Calculator',
    target_v1_components: ['MoneyField', 'Slider', 'Receipt'],
    label_note: 'Calculator: MoneyField for daily budget; Slider for days; Receipt for spend breakdown.',
  },
]

// ---------------------------------------------------------------------------
// RE_PROMPT_CONTINUITY_PROMPTS — 5 re-prompt continuity pairs.
// ADR-0009 Step 10 §11. Each pair: initial prompt + refinement prompt.
// The LLM should preserve the original component-set on the refinement
// unless the user explicitly requests a change.
// Pass-rate gate: ≥80% (run against live LLM in CI eval). T-0009-223.
// ---------------------------------------------------------------------------

export type ContinuityPromptEntry = {
  id: string
  initial: string
  refinement: string
  expected_archetype: V0Archetype
  preserved_components: string[]
  label_note: string
}

export const RE_PROMPT_CONTINUITY_PROMPTS: ContinuityPromptEntry[] = [
  {
    id: 'cont-01',
    initial: 'recipe book app where I can save recipes with ingredients and steps',
    refinement: 'add a photo for each recipe',
    expected_archetype: 'ListCRUD',
    preserved_components: ['StepList', 'List'],
    label_note: 'Refinement adds Image inside existing recipe records; must NOT re-architect StepList to Gallery.',
  },
  {
    id: 'cont-02',
    initial: 'habit tracker with a heatmap of my streaks',
    refinement: 'also let me add notes for each day',
    expected_archetype: 'Tracker',
    preserved_components: ['Heatmap'],
    label_note: 'Refinement adds a text field to existing entries; must NOT replace Heatmap with Calendar.',
  },
  {
    id: 'cont-03',
    initial: 'daily expense log where I enter amounts and categories',
    refinement: 'make the total stand out more',
    expected_archetype: 'Tracker',
    preserved_components: ['TransactionRow', 'MoneyField'],
    label_note: 'Refinement emphasizes the total (Stat/MetricTile tweak); must NOT replace TransactionRow with ListItem.',
  },
  {
    id: 'cont-04',
    initial: 'travel journal where I write about each day and attach photos',
    refinement: 'add a rating so I can rate each day of the trip',
    expected_archetype: 'Journal',
    preserved_components: ['Image', 'Gallery'],
    label_note: 'Refinement adds RatingInput to each entry; must NOT replace Gallery with a bare List.',
  },
  {
    id: 'cont-05',
    initial: 'tip calculator with a receipt showing subtotal, tax, and total',
    refinement: 'add a slider for the tip percentage instead of typing it',
    expected_archetype: 'Calculator',
    preserved_components: ['Receipt', 'MoneyField'],
    label_note: 'Refinement swaps NumberField for Slider on tip percent; must NOT remove Receipt or MoneyField.',
  },
]
