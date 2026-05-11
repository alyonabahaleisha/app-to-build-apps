# Prompt Grading — {YYYY-MM-DD}

_Graders:_ Sable (UX), {engineer name}
_Prompt version under test:_ vX.Y.Z
_Eval baseline pass rate:_ {overall_pct} overall / ListCRUD: {lc_pct} / Tracker: {tr_pct} / Journal: {jr_pct} / Calculator: {ca_pct}
_Sample size:_ 40 prompts (10 per archetype, random seed: {seed})
_Eval results file:_ `services/api/eval/results/{filename}`

---

## Rubric

The **Primary score** (1–5) is the single number that moves the baseline.
Dimension scores (1–5 or N/A) are qualitative signal for the next iteration.

| Primary | Meaning |
| --- | --- |
| 1 | Broken / wrong archetype / would not ship |
| 2 | Structurally correct but visually weak across most dimensions |
| 3 | Acceptable; one or two notable weaknesses |
| 4 | Good; could ship with minor copy tweaks |
| 5 | Design-Sable-could-ship — the LLM wrote what she would have |

Dimension scores use the same 1–5 scale, scoped to the named dimension.
Each dimension cell is `1–5` OR `N/A` with a one-word reason (e.g. `N/A: single-screen`).

**Pass-bar:** an archetype passes the weekly bar when its Primary average is ≥3.5.
The week passes when all 4 archetypes pass.

References: ADR-0007 (eval harness), ADR-0010 (grading loop).

---

## Sample selection

| Prompt ID | Archetype | Prompt text (first 80 chars) |
| --- | --- | --- |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |
| <prompt_id> | <archetype> | <prompt_text_80> |

---

## Per-prompt grades

| Prompt ID | Primary (1–5) | Appropriateness | Layout | Stance/Palette | Verb usage | Copy | Empty state | Scope precision | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |
| <prompt_id> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | <1-5> | |

---

## Per-archetype rollup

| Archetype | n | Primary avg | Pass-bar met (≥3.5)? | Top weak dimension |
| --- | --- | --- | --- | --- |
| ListCRUD | 10 | <avg> | <yes/no> | <dimension> |
| Tracker | 10 | <avg> | <yes/no> | <dimension> |
| Journal | 10 | <avg> | <yes/no> | <dimension> |
| Calculator | 10 | <avg> | <yes/no> | <dimension> |

---

## Sable's notes — themes across the sample

(Free-form bullets. The next prompt iteration reads this. Format: 1
bullet per actionable observation. Anti-pattern: 1 bullet per individual prompt.)

- <observation>
- <observation>

---

## Prompt iteration proposal (drafted by engineer post-session)

- **Hypothesis:** {one sentence}
- **Proposed change to `SYSTEM_PROMPT_CATALOG`:** {section + before/after diff, ≤500 chars}
- **Expected impact:** {which archetypes, which dimensions}
- **Token budget delta:** {chars added / chars removed; remaining headroom}
- **Next bump:** {v0.2.0 etc.}
