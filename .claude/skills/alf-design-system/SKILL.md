---
description: "ALF design system skill: atoms, tokens, themes, component patterns for the Bluesky Social App"
user-invocable: false
---

# ALF Design System Skill

Reference material for the ALF (Application Layout Framework) design system used in the Bluesky Social App. Consumed by `designer` and `rn-executor`.

## Core Concepts

### Static Atoms
Theme-independent styles imported from `#/alf`:

```typescript
import {atoms as a} from '#/alf'

// Layout
a.flex_row, a.flex_col, a.flex_1, a.flex_wrap
a.align_center, a.align_start, a.align_end
a.justify_between, a.justify_center

// Spacing (t-shirt sizes)
a.gap_2xs, a.gap_xs, a.gap_sm, a.gap_md, a.gap_lg, a.gap_xl, a.gap_2xl
a.p_2xs, a.p_xs, a.p_sm, a.p_md, a.p_lg, a.p_xl, a.p_2xl
a.px_md, a.py_lg  // directional padding

// Typography
a.text_xs, a.text_sm, a.text_md, a.text_lg, a.text_xl
a.font_bold, a.font_semibold, a.font_normal

// Borders
a.border, a.border_t, a.border_b
a.rounded_sm, a.rounded_md, a.rounded_full

// Others
a.overflow_hidden, a.w_full, a.h_full
```

### Theme Atoms
Theme-dependent colors from `useTheme()`:

```typescript
const t = useTheme()

// Backgrounds
t.atoms.bg          // primary background
t.atoms.bg_contrast_25, t.atoms.bg_contrast_50  // subtle backgrounds

// Text
t.atoms.text        // primary text
t.atoms.text_contrast_medium  // secondary text
t.atoms.text_contrast_low     // muted text

// Borders
t.atoms.border_contrast_low
t.atoms.border_contrast_medium
t.atoms.border_contrast_high

// Palette colors
t.palette.primary_500    // brand blue
t.palette.negative_400   // error red
t.palette.positive_500   // success green
```

### Platform Utilities
```typescript
import {web, native, ios, android, platform} from '#/alf'

const styles = [
  a.p_md,
  web({cursor: 'pointer'}),
  native({paddingBottom: 20}),
  platform({
    ios: {shadowOpacity: 0.1},
    android: {elevation: 2},
    web: {boxShadow: '0 1px 3px rgba(0,0,0,0.1)'},
  }),
]
```

### Breakpoints
```typescript
import {useBreakpoints} from '#/alf'

const {gtPhone, gtMobile, gtTablet} = useBreakpoints()
```

## Component Library

### Button
```typescript
import {Button, ButtonText, ButtonIcon} from '#/components/Button'

// Props:
// color: 'primary' | 'secondary' | 'negative' | 'primary_subtle' | 'negative_subtle' | 'secondary_inverted'
// size: 'tiny' | 'small' | 'large'
// shape: 'default' | 'round' | 'square' | 'rectangular'
// variant: 'solid' | 'outline' | 'ghost' (deprecated)

<Button label="Save" onPress={handleSave} color="primary" size="large">
  <ButtonText>Save</ButtonText>
</Button>
```

### Dialog
```typescript
import * as Dialog from '#/components/Dialog'

const control = Dialog.useDialogControl()

// CRITICAL: Always use control.close(() => ...) for actions after close
control.close(() => {
  navigation.navigate('Home')
})
```

### Menu
```typescript
import * as Menu from '#/components/Menu'

<Menu.Root>
  <Menu.Trigger label="Open menu">
    {({props}) => <Button {...props}><ButtonIcon icon={DotsHorizontal} /></Button>}
  </Menu.Trigger>
  <Menu.Outer>
    <Menu.Item label="Edit" onPress={handleEdit}>
      <Menu.ItemIcon icon={Pencil} />
      <Menu.ItemText>Edit</Menu.ItemText>
    </Menu.Item>
  </Menu.Outer>
</Menu.Root>
```

### TextField
```typescript
import * as TextField from '#/components/forms/TextField'

<TextField.LabelText>Email</TextField.LabelText>
<TextField.Root>
  <TextField.Icon icon={AtSign} />
  <TextField.Input
    label="Email address"
    defaultValue={email}
    onChangeText={setEmail}
  />
</TextField.Root>
```

### Typography
```typescript
import {Text, H1, H2, P} from '#/components/Typography'

<H1 style={[a.text_xl, a.font_bold]}>Heading</H1>
<Text emoji>Hello!</Text>  // emoji prop for text with emoji
```

## Key Files

| Purpose | Location |
|---------|----------|
| Theme definitions | `src/alf/themes.ts` |
| Design tokens | `src/alf/tokens.ts` |
| Static atoms | `src/alf/atoms.ts` |

## Anti-patterns

- **Never hardcode colors** — use `t.atoms.*` or `t.palette.*`
- **Never use `useMemo`/`useCallback`** proactively — React Compiler handles it
- **Never use `value` on TextInput** when `defaultValue` works — performance issues
- **Never forget `label` prop** on interactive elements
