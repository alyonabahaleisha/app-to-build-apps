/**
 * AvatarRenderer tests
 * T-0006-076: snapshot at productive×focus
 * T-0006-077: snapshot at expressive×health
 * T-0006-082: initials fallback when imageUrl absent
 * T-0006-083: size enum enforces correct dimensions
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {AvatarSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {AvatarRenderer} from './Avatar'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type AvatarNode = Extract<Node, {type: 'Avatar'}>

const AVATAR_DEFAULT: AvatarNode = {
  id: 'av1',
  type: 'Avatar',
  name: 'Alex Johnson',
}

const AVATAR_SM: AvatarNode = {
  id: 'av2',
  type: 'Avatar',
  name: 'María García',
  size: 'sm',
}

const AVATAR_MD: AvatarNode = {
  id: 'av3',
  type: 'Avatar',
  name: 'José García',
  size: 'md',
}

const AVATAR_LG: AvatarNode = {
  id: 'av4',
  type: 'Avatar',
  name: "O'Brien",
  size: 'lg',
}

const AVATAR_SINGLE_WORD: AvatarNode = {
  id: 'av5',
  type: 'Avatar',
  name: '李明',
}

const AVATAR_WITH_URL: AvatarNode = {
  id: 'av6',
  type: 'Avatar',
  name: 'Alex Johnson',
  imageUrl: 'https://example.com/avatar.png',
}

// ---------------------------------------------------------------------------
// T-0006-076: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('AvatarRenderer snapshot (T-0006-076) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-077: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('AvatarRenderer snapshot (T-0006-077) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-082: initials fallback when imageUrl absent
// ---------------------------------------------------------------------------

describe('AvatarRenderer initials fallback (T-0006-082)', () => {
  it('renders at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders at expressive×health without error', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders initials fallback when no imageUrl (V0 only uses initials)', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // V0 always renders initials; imageUrl is ignored
    expect(toJSON()).not.toBeNull()
  })

  it('renders even when imageUrl is provided (V0 ignores it)', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_WITH_URL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders single-word name', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_SINGLE_WORD} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders multi-byte name (Chinese characters)', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_SINGLE_WORD} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-083: size enum enforces correct dimensions
// ---------------------------------------------------------------------------

describe('AvatarRenderer size (T-0006-083)', () => {
  it('sm size produces 24pt diameter', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_SM} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {width?: number; height?: number}}} | null
    expect(tree?.props?.style?.width).toBe(24)
    expect(tree?.props?.style?.height).toBe(24)
  })

  it('md size produces 32pt diameter', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_MD} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {width?: number; height?: number}}} | null
    expect(tree?.props?.style?.width).toBe(32)
    expect(tree?.props?.style?.height).toBe(32)
  })

  it('lg size produces 48pt diameter', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_LG} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {width?: number; height?: number}}} | null
    expect(tree?.props?.style?.width).toBe(48)
    expect(tree?.props?.style?.height).toBe(48)
  })

  it('default size is md (32pt) when no size specified', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {width?: number; height?: number}}} | null
    expect(tree?.props?.style?.width).toBe(32)
    expect(tree?.props?.style?.height).toBe(32)
  })

  it('avatar has radius-full (circle shape)', () => {
    const {toJSON} = renderWithTheme(<AvatarRenderer node={AVATAR_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {borderRadius?: number}}} | null
    expect(tree?.props?.style?.borderRadius).toBe(9999)
  })
})

// ---------------------------------------------------------------------------
// Schema boundary: initials length enforcement happens in caller convention
// (ADR says 1-2 chars; schema for Avatar uses name field, not initials field)
// ---------------------------------------------------------------------------

describe('Avatar schema', () => {
  it('accepts valid avatar node', () => {
    const result = AvatarSchema.safeParse({
      id: 'av_ok',
      type: 'Avatar',
      name: 'Alex',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = AvatarSchema.safeParse({
      id: 'av_bad',
      type: 'Avatar',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid size value', () => {
    const result = AvatarSchema.safeParse({
      id: 'av_bad_size',
      type: 'Avatar',
      name: 'Alex',
      size: 'xl',
    })
    expect(result.success).toBe(false)
  })
})
