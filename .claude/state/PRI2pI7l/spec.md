# Spec: Quick-react bar on posts (PRI2pI7l)

> Source: Trello card PRI2pI7l — https://trello.com/c/PRI2pI7l
> Status: **Ready for planning.** 18 acceptance criteria present; all testable. Soft clarifications tracked in `ac_check.json`.

## Problem Statement

A user who wants to respond to a post today has three options: Like (binary, low expressivity), Reply (full composer, high commitment, carries moderation/threading implications), or Quote (publishes a new post on their timeline). None of these let a user signal a quick emotional reaction ("this is funny", "I'm watching this", "this is hype") at low cost. The result is that a majority of feed impressions receive no engagement signal, and users with low authorship intent go silent.

"Quick-react" lowers the floor to interaction with a four-emoji expression vocabulary (heart, fire, eyes, joy) reached via a platform-native gesture. This is a v0 surface: one reaction per viewer per post, no aggregates, no other-users visibility, no federation.

## Target Personas

- **Lurker / low-effort consumer.** Scrolls frequently, rarely replies. The primary target — wants to express a reaction without composing.
- **Engagement-seeking author.** Indirect beneficiary: their own feed view does not change in v0 (no aggregate counts), but future v1 work unlocks richer author feedback.
- **Accessibility-dependent user.** Screen-reader and keyboard-only users must have first-class parity via the `React to post` a11y action and full keyboard flow (AC-7, AC-11).
- **Product/growth analyst.** Needs instrumented events (AC-18) to evaluate whether reactions increase per-impression engagement.

## Success Metrics (KPIs)

1. **Per-impression engagement rate.** Share of viewed posts that receive any user action (reaction, like, reply, repost) among users in the `quick_reactions_v0` ON variant vs. OFF control. Primary success signal. Target: directionally positive lift.
2. **Reaction adoption funnel.** Bar-open (AC-18a) → emoji-select (AC-18b) conversion, plus remove-rate (AC-18c). Diagnoses whether the gesture is discoverable and whether the emoji set matches intent.
3. **Reaction write reliability.** Client-observed success rate and P95 latency for the reaction endpoint (AC-1). Must stay within the envelope of existing like writes; AC-16 sets the 100ms optimistic-update bar for perceived latency.

Secondary (watch, not gate):
- Reply-composer abandonment rate — hypothesis that reactions absorb low-intent replies.
- Error/retry volume on flagged rollout cohort vs. control.

## Scope

### In
- New reaction write endpoint keyed by (viewer DID, post URI) with emoji in {heart, fire, eyes, joy} (AC-1).
- Change and remove semantics; one reaction per viewer per post (AC-2).
- Native gesture: long-press >=400ms on post body (AC-4); light-impact haptic on selection (AC-5).
- Web gesture: hover >=200ms reveals React button; click opens popover; Escape / outside-click dismiss (AC-6); full keyboard parity (AC-7).
- Surfaces: `PostFeedItem` (src/view/com/posts/PostFeedItem.tsx) and thread post components only (AC-8).
- Chip rendering inline with post controls; cross-device persistence (AC-9).
- A11y action `React to post` with localized emoji labels (AC-11).
- Reduced-motion behavior (AC-12), Lingui translation of all emoji labels (AC-13), RTL mirroring (AC-14).
- Feature flag `quick_reactions_v0`, default OFF, runtime-flippable (AC-15).
- Optimistic update within 100ms, revert + non-blocking toast on failure, no retry loop (AC-16).
- 2s debounce on repeated selections on the same post (AC-17).
- Analytics on bar-open, emoji-select, reaction-remove (AC-18).

### Out (explicit, from ticket)
- atproto lexicon, federation, firehose integration.
- Custom emoji set, skin tones.
- Aggregate counts, reacted-by-viewer, other-user reactions (AC-10).
- Author notifications.
- Reactions on DMs, profiles, lists, feed generators.
- Quote, embed, search-result, notification-item surfaces (AC-8).
- Swipe gesture (long-press + hover only).
- Reaction-specific moderation controls.
- Like button refactor / merge with reactions.
- Reactions in composer / reply flow.

## Dependencies

- **Reaction storage service.** AC-1 and AC-9 require a server-side endpoint keyed by viewer DID + post URI that persists across devices. Since atproto lexicon is explicitly out of scope, this must be a Bluesky-owned service (e.g., an appview-side table). Confirm ownership before arch plan.
- **Feature flag infrastructure.** AC-15 requires a runtime-flippable gate. Codebase search finds only `src/state/session/logging.ts` referencing Statsig; no established `useGate` primitive. Arch plan must select/introduce the gating mechanism.
- **Existing post action row.** `PostFeedItem` and thread post components must expose a stable mount point for the chip (AC-9) and gesture target (AC-4, AC-6).
- **Haptics.** `src/lib/haptics.ts` already exists and must respect system prefs (AC-5).
- **Analytics pipeline.** AC-18 events need event-name registration, payload schema (post URI hash, emoji code, surface, platform, flag variant), and a URI hash primitive.
- **Lingui pipeline.** Standard extract/compile (handled by CI per CLAUDE.md).
- **Gesture library.** `react-native-gesture-handler` for native long-press; web uses existing popover/focus primitives.

## Risks

- **Feature-flag plumbing is net-new.** AC-15's requirement for a runtime-flippable gate with zero network calls when OFF is straightforward but requires that the flag be read *before* any query hook or analytics event fires. Easy to get wrong by checking the flag inside the query function.
- **Gesture conflict on native.** Long-press on the post body overlaps with existing post long-press behaviors (e.g., image viewers, link previews, post context menus if any). AC-4 needs explicit arbitration with existing gestures during arch planning.
- **Touch-capable web.** AC-6 specifies hover, which is unreliable on touch laptops/iPad web. A fallback affordance is not specified and is tracked as an open question.
- **Cross-device persistence without federation.** AC-9 plus the out-of-scope atproto lexicon implies a Bluesky-centralized service. Users on third-party clients will not see their own reactions — acceptable for v0 but must be understood and communicated.
- **Optimistic-update correctness.** AC-16 (100ms optimistic, revert on failure, no retry) combined with AC-17 (2s debounce) requires careful state coordination: the debounced request must carry the *final* selection, and the optimistic UI must reflect the final selection even while the request is in flight.
- **A11y gating.** AC-11 requires an accessibility action that is equivalent to the gesture. This cannot be an afterthought layered on the long-press — it is the screen-reader entry point and must be designed into the component from the start.
- **Analytics privacy.** AC-18 includes post URI in events; hashing algorithm must be explicit (open question) to avoid leaking author identifiers.

## Platform Considerations

- **iOS.** Long-press + haptic is idiomatic (Tapback-like). Respect `UIAccessibilityIsReduceMotionEnabled` (AC-12) and system haptic prefs (AC-5).
- **Android.** Long-press is idiomatic; must not collide with system back gesture or any swipe actions on feed items. Haptic via the same `src/lib/haptics.ts` abstraction.
- **Web.** Hover >=200ms reveal (AC-6) with popover; full keyboard flow (AC-7). Reduced-motion via `prefers-reduced-motion` media query (AC-12).
- **RTL.** Emoji order and popover anchor mirror under Arabic/Hebrew (AC-14).

## Edge Cases Covered by AC

- Offline / network failure → optimistic revert + toast, no retry (AC-16).
- Rapid selection changes → 2s debounce to single write (AC-17).
- Re-tap same emoji → remove (AC-2).
- Feature-off state → zero surface footprint (AC-15).
- Reduced-motion → opacity-only (AC-12).
- Screen reader → a11y action with localized labels (AC-11, AC-13).

## Open Clarifications (non-blocking)

See `ac_check.json` → `questions_for_reporter`. Six items: post-body gesture scope, touch-web hover fallback, flag system choice, debounce semantics, URI hash algorithm, storage backend ownership. None block planning; all should be resolved during arch/design phase.
