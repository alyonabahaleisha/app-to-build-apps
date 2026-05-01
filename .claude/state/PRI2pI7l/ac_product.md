# Quick-React Bar on Posts — v0 Acceptance Criteria

**Ticket:** Trello PRI2pI7l — Quick-react bar on posts
**Version:** v0 (gated rollout; local-only reactions, no federation)
**Owner:** Product

## v0 Scope Summary (from prior agent comment, now ratified)

- Fixed 4-emoji set: heart (red heart), fire, eyes, laugh-crying (joy).
- Trigger: long-press on post body on native (iOS + Android); hover-reveal affordance on web.
- Reaction is independent of Like. Reactions and Likes can both exist on the same post by the same user; they never replace each other.
- One reaction per user per post. User can change or remove their reaction.
- Surfaces: home/following/custom feed items AND thread-view posts only. No embeds, no quote-post embeds, no notifications screen, no feed-generator previews.
- No federation, no AT Protocol lexicon, no cross-PDS visibility in v0. Reactions are stored via a Bluesky-owned private endpoint and visible only to users whose client has the feature enabled.
- No author notifications in v0.
- Gated behind a feature flag. If the feature-flag infrastructure does not yet exist in this repo, adding a minimal gate is in-scope for v0 implementation (see AC-15).
- Accessibility: screen readers get an explicit "React to post" action that opens an accessible picker.

---

## Acceptance Criteria

### Data & API

**AC-1 — Reaction write endpoint wired**
GIVEN an authenticated user viewing a post on a feed or thread surface,
WHEN the client sends a reaction with emoji ∈ {heart, fire, eyes, joy} for that post URI,
THEN the client receives a 2xx response and the reaction is persisted on the server keyed by (viewer DID, post URI).
Testable: network-level assertion; integration test mocks the endpoint and asserts request shape (post URI, post CID, emoji code, action=set).

**AC-2 — Reaction change/remove**
GIVEN a user has an existing reaction `X` on post `P`,
WHEN the user selects a different emoji `Y` from the quick-react bar,
THEN the previous reaction `X` is removed and `Y` is persisted; the post shows exactly one reaction from the viewer.
AND WHEN the user taps their currently-selected emoji again,
THEN the reaction is removed and the post shows no reaction from the viewer.
Testable: UI state assertion + single outgoing mutation per action.

**AC-3 — Reaction independent of Like**
GIVEN a user has liked post `P`,
WHEN the user adds a reaction to `P`,
THEN the like is preserved (like count unchanged, heart-icon state unchanged), and the reaction is added.
AND the inverse: adding/removing a reaction never triggers a like mutation, and tapping like never triggers a reaction mutation.
Testable: two independent mutation calls tracked; no cross-triggering in instrumentation.

### Interaction — Native (iOS + Android)

**AC-4 — Long-press trigger on native**
GIVEN a post rendered in the feed or thread view on iOS or Android,
WHEN the user presses-and-holds the post body for ≥ 400ms,
THEN a reaction bar appears anchored to the post containing the 4 emoji in fixed order: heart, fire, eyes, joy.
AND releasing the press over an emoji selects it; releasing off-target dismisses the bar with no reaction change.
Testable: gesture timing test with `jest-native` / detox, threshold constant defined in code.

**AC-5 — Haptic on native selection**
GIVEN the reaction bar is visible on iOS or Android,
WHEN the user selects or changes a reaction,
THEN a light impact haptic fires once per selection (respecting system haptic preferences).
Testable: haptic API mocked and asserted called exactly once per successful selection.

### Interaction — Web

**AC-6 — Hover-reveal affordance on web**
GIVEN a post rendered on web (viewport ≥ mobile-web breakpoint with a pointer device),
WHEN the user hovers over the existing post controls row for ≥ 200ms,
THEN a "React" button with a smiley icon appears within the controls row.
AND clicking the "React" button opens a popover containing the 4 emoji; clicking an emoji selects it; clicking outside or pressing Escape dismisses the popover.
Testable: DOM assertion on hover state + popover open/close state.

**AC-7 — Web keyboard activation**
GIVEN keyboard focus is on a post's controls row on web,
WHEN the user tabs to the "React" button and presses Enter or Space,
THEN the reaction popover opens and initial focus is on the first emoji option; arrow keys move between emoji; Enter selects; Escape closes.
Testable: RTL keyboard-navigation test asserting focus ring and selection.

### Surface Scope

**AC-8 — Reactions appear only on feed and thread surfaces**
GIVEN the v0 feature is enabled,
WHEN a post is rendered inside `PostFeedItem` (home/following/custom feeds) or the thread post components (`ThreadItemPost`, `ThreadItemAnchor`, `ThreadItemTreePost`),
THEN the quick-react bar/affordance is available.
AND WHEN the same post is rendered as a quote-post embed, search result preview, notification item, or feed-generator preview,
THEN the quick-react bar/affordance is NOT rendered and long-press/hover does not open a reaction UI.
Testable: component snapshot / unit assertion per surface.

### Display

**AC-9 — Viewer's reaction is visible on the post**
GIVEN a user has reacted to a post,
WHEN the post is re-rendered on any in-scope surface (feed or thread),
THEN a small chip showing the viewer's selected emoji is displayed inline with the post controls row.
AND the chip is visible across app restarts and across devices for the same account.
Testable: UI snapshot + persistence test using the reactions query.

**AC-10 — No aggregate counts in v0**
GIVEN any post with reactions from any number of users,
WHEN the post is rendered,
THEN only the current viewer's own reaction is displayed. No per-emoji counts, no other users' reactions, and no "reacted-by" list viewer are shown.
Testable: DOM/snapshot assertion that no count elements render.

### Accessibility

**AC-11 — Screen-reader entry point**
GIVEN a user with VoiceOver (iOS), TalkBack (Android), or a web screen reader focuses a post,
WHEN the user activates the post's actions rotor/menu,
THEN a "React to post" action is announced and available.
AND activating it opens an accessible emoji picker in which each option is announced with a localized label ("Heart", "Fire", "Eyes", "Laughing").
Testable: `accessibilityActions` / ARIA role assertions per platform.

**AC-12 — Reduced-motion compliance**
GIVEN the user has "Reduce Motion" enabled at the OS level (iOS/Android) or `prefers-reduced-motion: reduce` (web),
WHEN the reaction bar/popover is shown or dismissed,
THEN the reveal/dismiss uses an instant opacity change (no scale/translate animation).
Testable: animation config switched by accessibility flag, unit-tested.

### Internationalization

**AC-13 — Emoji labels are translatable**
GIVEN the app is rendering in any supported locale,
WHEN the reaction picker is opened,
THEN each emoji's screen-reader label is retrieved via Lingui (`msg` / `Trans`) and not hard-coded in English.
Testable: grep assertion that emoji labels pass through `_(msg\`…\`)`; extraction catches them.

**AC-14 — RTL layout mirrors bar**
GIVEN the user's locale is RTL (e.g., Arabic, Hebrew),
WHEN the reaction bar/popover renders,
THEN emoji order and anchoring mirror horizontally to match the surrounding UI.
Testable: snapshot under forced RTL.

### Rollout & Operational

**AC-15 — Feature flag gate**
GIVEN the quick-react feature flag is OFF for the current user,
WHEN any post is rendered on any surface,
THEN no long-press reaction bar opens on native, no "React" button appears on web, no screen-reader "React to post" action is exposed, and no reactions network calls are made.
AND flipping the flag ON at runtime (next app foreground / next page load) enables the feature without requiring a reinstall.
Testable: gated boolean driven by a single `isQuickReactEnabled()` check covered by unit tests for both states.

**AC-16 — Optimistic UI + offline behavior**
GIVEN the user selects a reaction,
WHEN the network request is in flight,
THEN the chip updates optimistically within 100ms.
AND WHEN the request fails (network error, 4xx, 5xx) OR the device is offline,
THEN the optimistic state is reverted, a non-blocking toast "Couldn't save reaction" is shown, and no retry loop is triggered.
Testable: mutation hook unit-tested with success, offline, and server-error cases.

**AC-17 — Rate limiting**
GIVEN the user rapidly taps multiple different emoji on the same post within 2 seconds,
WHEN the selections occur,
THEN the client debounces and sends only the final selection to the server (1 request), with the intermediate selections reflected in the UI but not persisted individually.
Testable: mutation call count assertion in a rapid-fire test.

### Analytics

**AC-18 — Instrumentation events**
GIVEN the feature is enabled,
WHEN a user (a) opens the reaction bar, (b) selects an emoji, or (c) removes a reaction,
THEN corresponding analytics events are logged with: post URI hash, emoji code, surface (feed/thread), platform (ios/android/web), and flag variant.
Testable: analytics client mocked; 3 events asserted per flow.

### KPIs (success metrics — not AC, but used to validate the v0 rollout)

- **K1 — Reactions per DAU per day.** Target: median active user produces ≥ 1 reaction/day within 2 weeks of ramp.
- **K2 — Reaction-bar-open → reaction-selected conversion.** Target: ≥ 35% of opens result in a selection (otherwise the affordance is confusing or misplaced).
- **K3 — Post-reaction error rate.** Technical. Target: < 0.5% of reaction writes fail end-to-end (excluding offline).

---

## Explicitly Out of Scope for v0

The following MUST NOT be built as part of this ticket. Each is a candidate for a follow-up ticket.

1. **Federation / AT Protocol lexicon.** No `app.bsky.feed.reaction` record, no repo writes, no firehose emission. Reactions are stored in a Bluesky-private store keyed by viewer DID + post URI.
2. **Custom emoji / user-configurable set.** The 4-emoji set is fixed. No picker extension, no skin tones, no per-user favorites.
3. **Aggregate counts and "reacted-by" lists.** No per-emoji counts displayed; no "who reacted" viewer analogous to liked-by.
4. **Author notifications.** The post author is NOT notified when someone reacts. The notifications tab is not modified.
5. **Reactions on non-post entities.** No reactions on DMs/chat messages, no reactions on feed generators, no reactions on profiles or lists.
6. **Quote-post, embed, search-result, and notification-item surfaces.** Reactions are disabled on these surfaces in v0.
7. **Swipe gesture.** The original ticket said "long-press or swipe"; v0 ships long-press (native) and hover/click (web) only. Swipe is deferred.
8. **Moderation controls specific to reactions.** No per-reaction reporting, no label application to reactions, no setting to hide reactions from muted/blocked users (since reactions are viewer-only in v0, this is moot but should not be built).
9. **Reactions replacing or merging with likes.** Reactions and likes remain fully independent; do not refactor the like button.
10. **Reactions UI in the composer or reply flow.** The feature is consumption-only; no "quick-react to your own draft" or similar.

---

## Unresolved product questions (non-blocking for v0 implementation, but must be answered before GA)

- **Q1 — Backing store confirmation.** v0 assumes a Bluesky-private key/value endpoint (viewer-DID keyed). Engineering must confirm the endpoint exists or schedule a spike; this AC list assumes it does or will be stubbed behind the flag.
- **Q2 — Feature-flag infrastructure.** No `useGate` / Statsig wiring was found in `src/`. A minimal in-repo gate (e.g., a `src/lib/flags/quickReact.ts` boolean backed by persisted prefs or env) is acceptable for v0; product defers to engineering on the exact mechanism, but AC-15 must pass.
- **Q3 — GA criteria.** Before flipping to 100%, we need a product review of K1/K2/K3 after ≥ 2 weeks of ramp. Not blocking for v0 build.
