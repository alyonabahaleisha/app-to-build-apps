/**
 * V0 eval prompt sets — ADR-0007 Step 7.
 *
 * Three exports:
 *   ARCHETYPE_PROMPTS         — 100 prompts, 25 per archetype (ListCRUD, Tracker, Journal, Calculator)
 *   OUT_OF_SCOPE_DETECTION_PROMPTS — 30 prompts, 6 per capability (image_gen, vision, chat, transcription, classification)
 *   OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS — 30 in-scope prompts that brush against out-of-scope capabilities
 *
 * Labeling methodology: each prompt maps unambiguously to the labeled archetype or capability.
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
