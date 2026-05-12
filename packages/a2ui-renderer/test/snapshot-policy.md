# Renderer Snapshot Policy

_Last updated: Step 9 (ADR-0009) — V1 Phase 1 catalog expansion_

## Why 2 of 12 registers?

The renderer supports 12 stance×palette combinations (2 stances × 6 palettes).
Snapshotting every component across all 12 registers would produce 636 snapshots
(53 × 12). That's unmanageable: a single token change in the design-system would
produce 636 snapshot diffs for Roz to review. The signal-to-noise ratio collapses.

We snapshot 2 canonical registers instead:

| Register | Stance | Palette | Why this pair |
|---|---|---|---|
| Productive × Focus | productive | focus | Cobalt accent, sans-serif throughout, tighter spacing. Covers the productive stance's most common deployment. |
| Expressive × Health | expressive | health | Sage olive accent, serif headings, looser spacing. Covers the expressive stance's alternate typography and color path. |

These two registers maximize visual variety per snapshot: they exercise different
accent colors, different font stack paths (sans vs. serif headings), and different
spacing scales. A component regression that only manifests on expressive or only
on a non-focus palette will still show up in this sample.

53 components × 2 = **106 snapshots**. That is the Step 9 matrix (V0: 28 components,
56 snapshots per ADR-0006 Step 12; V1 Phase 1 adds 25 components, 50 snapshots).

## What polish-review week adds (week 5)

In week 5, Sable runs a visual review across all 12 registers on a physical device.
This extends the matrix to 636 visual states — but it's a human-in-the-loop review,
not a CI snapshot gate. The integration test (`src/v0/__demo__/`) renders one sample
spec per archetype across all 12 registers during this review.

If a visual regression is found in a non-matrix register during polish review, we:
1. Add the failing register to the snapshot matrix for that component.
2. Fix the regression.
3. Update the snapshot.

We do not add all 12 registers to CI preemptively. The 106-snapshot matrix is the
right CI gate for V0.

## Updating snapshots

When a design-system token change is intentional (e.g., a palette tweak):

```bash
# Update all V0 component snapshots:
pnpm --filter @app-creator/a2ui-renderer test:rn -- -u

# Or target a specific component:
pnpm --filter @app-creator/a2ui-renderer test:rn -- -u Button
```

**Required: include a code-review note** explaining which token changed and why
the snapshot diff is expected. Snapshots must not be silently updated.

## Files

| Path | Description |
|---|---|
| `src/v0/snapshot-matrix.test.tsx` | Parameterized matrix test; T-0006-180..235, T-0006-236, T-0006-237..286 |
| `src/v0/viewport.test.tsx` | iPhone SE boundary test; T-0006-178 |
| `src/v0/components/*/` | Per-component snapshot files; 2 per component from build steps |

## CI

The `renderer-snapshot-matrix.yml` workflow runs the matrix test on every push
to `packages/a2ui-renderer/**`. It fails on snapshot drift (jest exits non-zero
when stored and generated snapshots differ). The fix is always an intentional
update with a code-review note, not a silent `--updateSnapshot` commit.
