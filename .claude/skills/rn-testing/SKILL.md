---
description: "React Native testing skill: Jest tests, test patterns, coverage for the Bluesky Social App"
user-invocable: false
---

# React Native Testing Skill

Provides canonical commands and patterns for running tests in the Bluesky Social App.

## Test Infrastructure

- **Test runner**: Jest
- **Test framework**: Jest + React Testing Library
- **Type checking**: TypeScript (`yarn typecheck`)
- **Linting**: ESLint (`yarn lint`)

## Running Tests

### All tests
```bash
yarn test 2>&1
```

### Specific test file
```bash
yarn test --testPathPattern="src/screens/Profile" 2>&1
```

### Specific test by name
```bash
yarn test --testNamePattern="should render profile" 2>&1
```

### With coverage
```bash
yarn test --coverage 2>&1
```

### Watch mode (development)
```bash
yarn test --watch 2>&1
```

## Test Output Parsing

### Jest output patterns

**Test pass:**
```
PASS src/screens/Profile/__tests__/ProfileScreen.test.tsx
  ✓ should render profile header (42 ms)
```

**Test fail:**
```
FAIL src/screens/Profile/__tests__/ProfileScreen.test.tsx
  ✕ should render profile header (55 ms)
```

**Summary:**
```
Tests:       2 failed, 15 passed, 17 total
Snapshots:   0 total
Time:        3.456 s
```

### Extracting results
- Count lines with `✓` (passed) and `✕` (failed)
- Parse the `Tests:` summary line
- Exit code 0 = all tests passed, non-zero = some failed

## Test Patterns (Bluesky Conventions)

### Component test template
```typescript
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react-native'
import {MyComponent} from '../MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeTruthy()
  })

  it('should handle press', () => {
    const onPress = jest.fn()
    render(<MyComponent onPress={onPress} />)
    fireEvent.press(screen.getByLabelText('Button label'))
    expect(onPress).toHaveBeenCalled()
  })
})
```

### Query hook test template
```typescript
import {renderHook, waitFor} from '@testing-library/react-native'
import {useFeatureQuery} from '../queries/feature'

// Mock the agent
jest.mock('#/state/session', () => ({
  useAgent: () => ({
    app: {
      bsky: {
        feature: {
          get: jest.fn().mockResolvedValue({data: mockData}),
        },
      },
    },
  }),
}))

describe('useFeatureQuery', () => {
  it('should fetch data', async () => {
    const {result} = renderHook(() => useFeatureQuery({id: '123'}))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
  })
})
```

### Async test pattern
```typescript
it('should load data', async () => {
  render(<AsyncComponent />)
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeTruthy()
  })
})
```

## Test File Location

Tests should be co-located with their source:

```
src/
├── screens/
│   ├── ProfileScreen/
│   │   ├── index.tsx
│   │   ├── __tests__/
│   │   │   └── ProfileScreen.test.tsx
│   │   └── components/
├── state/
│   ├── queries/
│   │   ├── profile.ts
│   │   └── __tests__/
│   │       └── profile.test.ts
```

Or alongside the file:
```
src/components/
├── Button.tsx
├── Button.test.tsx
```

## Handling Flaky Tests

1. On first failure, note the specific test
2. Re-run only the failing test
3. If it passes on retry, mark as "flaky" in the report
4. If it fails again, mark as genuine failure

```bash
# Re-run specific failing test
yarn test --testPathPattern="FailingTest" --testNamePattern="failing test name" 2>&1
```

## Quality Gates

All three must pass for a clean build:
1. `yarn typecheck` — zero TypeScript errors
2. `yarn lint` — zero ESLint errors (warnings acceptable)
3. `yarn test` — all tests pass
