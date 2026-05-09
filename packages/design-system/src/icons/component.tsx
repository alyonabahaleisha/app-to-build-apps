/**
 * <Icon> — RN component that renders a Lucide icon by semantic name.
 *
 * Props:
 *   name   — one of the 80 canonical icon names from the protocol catalog
 *   size   — one of {16, 20, 24, 32} (literal union, TS enforces at call site — T-0005-231)
 *   color  — any color string (theme token resolved by the caller)
 *
 * The closed literal-union `size` type prevents invalid sizes at compile time.
 * No runtime guard needed — TS prevents the call site (F-16, T-0005-231).
 *
 * NAME_TO_COMPONENT maps the 80 kebab-case canonical names to their
 * lucide-react-native PascalCase component equivalents.
 */
import * as React from 'react'
import type {LucideProps} from 'lucide-react-native'
import * as LucideRN from 'lucide-react-native'
import type {IconName} from '@app-creator/protocol'

type LucideComponent = React.ComponentType<LucideProps>

// ---------------------------------------------------------------------------
// NAME_TO_COMPONENT
//
// Explicit mapping of all 80 canonical kebab-case names → PascalCase Lucide
// RN components. Explicit (not dynamic) so tree-shaking works and TypeScript
// can verify the mapping at build time.
// ---------------------------------------------------------------------------
const NAME_TO_COMPONENT: Record<IconName, LucideComponent> = {
  // Navigation (8)
  'chevron-left': LucideRN.ChevronLeft,
  'chevron-right': LucideRN.ChevronRight,
  'chevron-up': LucideRN.ChevronUp,
  'chevron-down': LucideRN.ChevronDown,
  'arrow-left': LucideRN.ArrowLeft,
  'arrow-right': LucideRN.ArrowRight,
  x: LucideRN.X,
  'more-horizontal': LucideRN.MoreHorizontal,
  // Action (10)
  plus: LucideRN.Plus,
  minus: LucideRN.Minus,
  share: LucideRN.Share,
  edit: LucideRN.Edit,
  trash: LucideRN.Trash,
  archive: LucideRN.Archive,
  copy: LucideRN.Copy,
  'refresh-cw': LucideRN.RefreshCw,
  save: LucideRN.Save,
  send: LucideRN.Send,
  // Indicator (8)
  info: LucideRN.Info,
  'alert-triangle': LucideRN.AlertTriangle,
  check: LucideRN.Check,
  'check-circle': LucideRN.CheckCircle,
  'x-circle': LucideRN.XCircle,
  'help-circle': LucideRN.HelpCircle,
  sparkles: LucideRN.Sparkles,
  dot: LucideRN.Dot,
  // Input (6)
  search: LucideRN.Search,
  filter: LucideRN.Filter,
  eye: LucideRN.Eye,
  'eye-off': LucideRN.EyeOff,
  mic: LucideRN.Mic,
  paperclip: LucideRN.Paperclip,
  // Content kind (10)
  list: LucideRN.List,
  'grid-2x2': LucideRN.Grid2x2,
  image: LucideRN.Image,
  file: LucideRN.File,
  link: LucideRN.Link,
  calendar: LucideRN.Calendar,
  clock: LucideRN.Clock,
  'map-pin': LucideRN.MapPin,
  tag: LucideRN.Tag,
  hash: LucideRN.Hash,
  // Activity (10)
  heart: LucideRN.Heart,
  star: LucideRN.Star,
  bookmark: LucideRN.Bookmark,
  flame: LucideRN.Flame,
  zap: LucideRN.Zap,
  target: LucideRN.Target,
  trophy: LucideRN.Trophy,
  medal: LucideRN.Medal,
  gift: LucideRN.Gift,
  'party-popper': LucideRN.PartyPopper,
  // Domain (16)
  book: LucideRN.Book,
  'book-open': LucideRN.BookOpen,
  dumbbell: LucideRN.Dumbbell,
  leaf: LucideRN.Leaf,
  droplet: LucideRN.Droplet,
  sun: LucideRN.Sun,
  'dollar-sign': LucideRN.DollarSign,
  brain: LucideRN.Brain,
  music: LucideRN.Music,
  camera: LucideRN.Camera,
  palette: LucideRN.Palette,
  code: LucideRN.Code,
  globe: LucideRN.Globe,
  coffee: LucideRN.Coffee,
  plane: LucideRN.Plane,
  rocket: LucideRN.Rocket,
  // Profile (4)
  user: LucideRN.User,
  users: LucideRN.Users,
  'log-out': LucideRN.LogOut,
  settings: LucideRN.Settings,
  // Commerce (4)
  'shopping-bag': LucideRN.ShoppingBag,
  'shopping-cart': LucideRN.ShoppingCart,
  'credit-card': LucideRN.CreditCard,
  receipt: LucideRN.Receipt,
  // Time (4)
  timer: LucideRN.Timer,
  hourglass: LucideRN.Hourglass,
  history: LucideRN.History,
  repeat: LucideRN.Repeat,
}

// ---------------------------------------------------------------------------
// IconProps
// ---------------------------------------------------------------------------
export type IconProps = {
  name: IconName
  /** Closed literal union — TypeScript prevents invalid sizes at call site (F-16, T-0005-231). */
  size: 16 | 20 | 24 | 32
  color: string
}

// ---------------------------------------------------------------------------
// <Icon>
// ---------------------------------------------------------------------------
export function Icon({name, size, color}: IconProps): React.ReactElement {
  const Component = NAME_TO_COMPONENT[name]
  return <Component size={size} color={color} />
}
