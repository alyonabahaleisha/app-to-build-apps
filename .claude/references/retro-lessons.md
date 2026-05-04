# Retro Lessons — Shared Reference

Lessons learned from past pipeline runs. Referenced by Cal, Colby, and Roz.

## normalizeRow() and passwordHash Leak

**What happened:** The `normalizeRow()` function in `users.store.js` returned
`passwordHash` to all callers because the ADR specified method signatures but
not return shapes. Colby added the field everywhere because the ADR didn't
say not to. Roz caught it in QA.

**Root cause:** Architecture gap, not implementation bug. When a store serves
both login (needs hash) and user listing (must NOT have hash), the ADR must
specify two normalization paths.

**Rules derived:**
- **Cal:** Every store method in the Data Sensitivity table must specify what
  it returns and what it excludes. Tag methods `public-safe` or `auth-only`.
- **Colby:** Before handoff, ask: "Who calls this function? Do ALL callers
  need ALL fields?" Default normalization must exclude sensitive fields.
  Create `normalizeRowWithSensitive()` for the one caller that needs it.
- **Roz:** In security review, check for store methods returning sensitive
  fields to callers that don't need them. Scope to current diff — flag
  pre-existing issues separately.

## /api/auth/status Exposing userCount

**What happened:** Robert's spec defined routes without defining response
shapes. Colby guessed and included `userCount` in a public endpoint — a
product decision that should have been Robert's call.

**Rules derived:**
- **Robert:** Every endpoint in the spec includes exact response shape,
  excluded fields, and public surface exposure.
- **Cal:** Carry this discipline into the ADR — don't just reference
  Robert's shapes, verify them.

## CI/CD Pipeline Breakage (ADR-0080)

**What happened:** ADR-0080 hardened anonymous role assignment from
admin-bypass to viewer. The load test CI job had no auth token and no
`AUTH_ANONYMOUS_ROLE` override. 286 write requests failed with 403.

**Rules derived:**
- **Cal:** ADR includes CI/CD Impact section. Grep CI configs for jobs
  exercising affected endpoints.
- **Roz:** Conditional CI/CD compatibility check when diff touches auth,
  RBAC, env vars, middleware. Flag `CI/CD Verification Required` for Eva.
- **Eva:** Verify pipeline won't break before Ellis commits.

## Incomplete Tests from ADR-Only Reading

**What happened:** During users-and-groups, Colby wrote tests from the ADR
alone and missed half the failure states because acceptance criteria and
edge cases were in Robert's feature spec.

**Rules derived:**
- **Colby:** Read the spec AND the ADR before writing tests. The ADR
  describes architecture. The spec describes expected behavior. You need
  both.
