---
description: "i18n skill: Lingui internationalization patterns, translation wrapping, pluralization for Bluesky Social App"
user-invocable: false
---

# i18n / Lingui Skill

Reference for internationalization in the Bluesky Social App using Lingui.

## Basic Patterns

### Simple strings
```typescript
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

function MyComponent() {
  const {_} = useLingui()
  const title = _(msg`Settings`)
  const error = _(msg`Something went wrong`)
}
```

### Strings with variables
```typescript
const greeting = _(msg`Hello, ${name}!`)
```

### Pluralization
```typescript
import {plural} from '@lingui/core/macro'

const count = _(plural(count, {
  one: '# item',
  other: '# items',
}))
```

### JSX content
```typescript
import {Trans} from '@lingui/react/macro'

<Text>
  <Trans>Welcome to <Text style={a.font_bold}>Bluesky</Text></Trans>
</Text>
```

## Rules

1. **All user-facing strings** must use `msg()` or `<Trans>`
2. **Never hardcode English strings** in the UI
3. **DO NOT run** `yarn intl:extract` or `yarn intl:compile` — these are handled by a nightly CI job
4. **Use `msg()` for string values** (props, variables)
5. **Use `<Trans>` for JSX content** (when embedding components in text)
6. **Never concatenate translated strings** — use template literals with `msg`

## Anti-patterns

```typescript
// WRONG - hardcoded string
<Text>Hello World</Text>

// CORRECT
<Text><Trans>Hello World</Trans></Text>

// WRONG - concatenation
const label = _(msg`Hello`) + " " + name

// CORRECT
const label = _(msg`Hello ${name}`)

// WRONG - manual pluralization
const text = count === 1 ? "1 item" : `${count} items`

// CORRECT
const text = _(plural(count, { one: '# item', other: '# items' }))
```
