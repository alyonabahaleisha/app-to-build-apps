/**
 * Icon component tests — T-0005-226, T-0005-227, T-0005-231 (Step 9)
 *
 * Tests: <Icon> RN component behavior.
 * Path data and schema tests live in packages/protocol/src/icons/icons.test.ts.
 *
 * lucide-react-native requires React Native at runtime and cannot run in Node.js.
 * We mock it with minimal component stubs that satisfy the LucideProps interface.
 */
import * as React from 'react'
import {Icon} from './component.js'
import {ICON_NAMES} from '@app-creator/protocol'

// Stub factory: returns a function component that validates size/color props.
// We don't use React.createElement here because the stubs just return null.
function makeIconStub(iconName: string) {
  const Stub = ({size, color}: {size: number; color: string}) => {
    if (typeof size !== 'number') throw new Error(`${iconName}: size must be a number`)
    if (typeof color !== 'string') throw new Error(`${iconName}: color must be a string`)
    return null
  }
  Stub.displayName = iconName
  return Stub
}

jest.mock('lucide-react-native', () => ({
  ChevronLeft: makeIconStub('ChevronLeft'),
  ChevronRight: makeIconStub('ChevronRight'),
  ChevronUp: makeIconStub('ChevronUp'),
  ChevronDown: makeIconStub('ChevronDown'),
  ArrowLeft: makeIconStub('ArrowLeft'),
  ArrowRight: makeIconStub('ArrowRight'),
  X: makeIconStub('X'),
  MoreHorizontal: makeIconStub('MoreHorizontal'),
  Plus: makeIconStub('Plus'),
  Minus: makeIconStub('Minus'),
  Share: makeIconStub('Share'),
  Edit: makeIconStub('Edit'),
  Trash: makeIconStub('Trash'),
  Archive: makeIconStub('Archive'),
  Copy: makeIconStub('Copy'),
  RefreshCw: makeIconStub('RefreshCw'),
  Save: makeIconStub('Save'),
  Send: makeIconStub('Send'),
  Info: makeIconStub('Info'),
  AlertTriangle: makeIconStub('AlertTriangle'),
  Check: makeIconStub('Check'),
  CheckCircle: makeIconStub('CheckCircle'),
  XCircle: makeIconStub('XCircle'),
  HelpCircle: makeIconStub('HelpCircle'),
  Sparkles: makeIconStub('Sparkles'),
  Dot: makeIconStub('Dot'),
  Search: makeIconStub('Search'),
  Filter: makeIconStub('Filter'),
  Eye: makeIconStub('Eye'),
  EyeOff: makeIconStub('EyeOff'),
  Mic: makeIconStub('Mic'),
  Paperclip: makeIconStub('Paperclip'),
  List: makeIconStub('List'),
  Grid2x2: makeIconStub('Grid2x2'),
  Image: makeIconStub('Image'),
  File: makeIconStub('File'),
  Link: makeIconStub('Link'),
  Calendar: makeIconStub('Calendar'),
  Clock: makeIconStub('Clock'),
  MapPin: makeIconStub('MapPin'),
  Tag: makeIconStub('Tag'),
  Hash: makeIconStub('Hash'),
  Heart: makeIconStub('Heart'),
  Star: makeIconStub('Star'),
  Bookmark: makeIconStub('Bookmark'),
  Flame: makeIconStub('Flame'),
  Zap: makeIconStub('Zap'),
  Target: makeIconStub('Target'),
  Trophy: makeIconStub('Trophy'),
  Medal: makeIconStub('Medal'),
  Gift: makeIconStub('Gift'),
  PartyPopper: makeIconStub('PartyPopper'),
  Book: makeIconStub('Book'),
  BookOpen: makeIconStub('BookOpen'),
  Dumbbell: makeIconStub('Dumbbell'),
  Leaf: makeIconStub('Leaf'),
  Droplet: makeIconStub('Droplet'),
  Sun: makeIconStub('Sun'),
  DollarSign: makeIconStub('DollarSign'),
  Brain: makeIconStub('Brain'),
  Music: makeIconStub('Music'),
  Camera: makeIconStub('Camera'),
  Palette: makeIconStub('Palette'),
  Code: makeIconStub('Code'),
  Globe: makeIconStub('Globe'),
  Coffee: makeIconStub('Coffee'),
  Plane: makeIconStub('Plane'),
  Rocket: makeIconStub('Rocket'),
  User: makeIconStub('User'),
  Users: makeIconStub('Users'),
  LogOut: makeIconStub('LogOut'),
  Settings: makeIconStub('Settings'),
  ShoppingBag: makeIconStub('ShoppingBag'),
  ShoppingCart: makeIconStub('ShoppingCart'),
  CreditCard: makeIconStub('CreditCard'),
  Receipt: makeIconStub('Receipt'),
  Timer: makeIconStub('Timer'),
  Hourglass: makeIconStub('Hourglass'),
  History: makeIconStub('History'),
  Repeat: makeIconStub('Repeat'),
}))

// ---------------------------------------------------------------------------
// T-0005-226: <Icon name="star" size={24} color="#000" /> renders without error
// ---------------------------------------------------------------------------
describe('T-0005-226: <Icon> — renders without error', () => {
  it("renders <Icon name='star' size={24} color='#000' /> without throwing", () => {
    // Call the component function directly — no RN renderer required in Node mode.
    expect(() => Icon({name: 'star', size: 24, color: '#000'})).not.toThrow()
  })

  it("returns a React element", () => {
    const el = Icon({name: 'star', size: 24, color: '#000'})
    // React.createElement returns a non-null object in the mock environment
    expect(el).not.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// T-0005-227: <Icon size={16} /> and <Icon size={32} /> both render
// ---------------------------------------------------------------------------
describe('T-0005-227: <Icon> — boundary sizes render', () => {
  it("size={16} renders without error", () => {
    expect(() => Icon({name: 'check', size: 16, color: '#fff'})).not.toThrow()
  })

  it("size={32} renders without error", () => {
    expect(() => Icon({name: 'check', size: 32, color: '#fff'})).not.toThrow()
  })

  it("size={20} renders without error", () => {
    expect(() => Icon({name: 'check', size: 20, color: '#fff'})).not.toThrow()
  })

  it("size={24} renders without error", () => {
    expect(() => Icon({name: 'check', size: 24, color: '#fff'})).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-231: <Icon size={9} /> is rejected at TypeScript compile time.
//
// The `size` prop is typed as `16 | 20 | 24 | 32`. The @ts-expect-error
// directive below asserts that passing 9 is a TS compile-time error.
// If the type is accidentally widened (e.g., to `number`), the @ts-expect-error
// becomes an "unused directive" error and this test file fails `tsc --noEmit`.
// Runtime guard not needed; TypeScript prevents the call site (F-16).
// ---------------------------------------------------------------------------
describe('T-0005-231: <Icon size={9} /> rejected at TypeScript compile time', () => {
  it('TS prevents invalid size at call site (compile-time only guard)', () => {
    // @ts-expect-error — TS2322: Type '9' is not assignable to type '16 | 20 | 24 | 32'
    // The @ts-expect-error above is the test: tsc --noEmit will fail if the size
    // type is accidentally widened (e.g., to 'number'), making '9' no longer an error.
    // If that happens, TS reports "Unused '@ts-expect-error' directive" and typecheck fails.
    const _unused = Icon({name: 'star', size: 9, color: '#000'})
    void _unused
    // No runtime assertion — TS compile-time enforcement is the guard (F-16, T-0005-231).
    expect(true).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Extra: all 80 icon names resolve to a component in NAME_TO_COMPONENT
// (verifies the mapping is complete)
// ---------------------------------------------------------------------------
describe('Icon component — all 80 names resolve to a component', () => {
  test.each(ICON_NAMES)("Icon({name: '%s', size: 24, color: '#000'}) renders", name => {
    expect(() => Icon({name, size: 24, color: '#000'})).not.toThrow()
  })
})

// Keep React in scope for JSX transform — this import is required by the TSX component.
void React.version
