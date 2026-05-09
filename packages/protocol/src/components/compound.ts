import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {ImageBindingSchema} from '../binding.js'

// ConditionalSection — renders children only if predicate matches.
// The entire conditional surface in V0 (brief §2.4 Registry 5): no expression DSL.
// children: z.array(z.unknown()) for Step 4; Step 5 wires in NodeSchema.
export const ConditionalSectionSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ConditionalSection'),
    collectionId: z.string().min(1).max(64),
    showWhen: z.enum(['whenEmpty', 'whenNotEmpty']),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ConditionalSection = z.infer<typeof ConditionalSectionSchema>

// ListSummary — single-line AI summary of a collection.
// The aiProcess(summarize) host component. On iOS 26+ Pro dispatches to Apple
// Foundation Models; on unsupported devices: hides (fallback: hide) or shows
// raw last-3 items (fallback: show-raw).
export const ListSummarySchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ListSummary'),
    collectionId: z.string().min(1).max(64),
    prompt: z.string().min(1).max(400),
    fallback: z.enum(['show-raw', 'hide']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ListSummary = z.infer<typeof ListSummarySchema>

// MediaTray — horizontal scrolling tray of images from a collection.
// imageField references a field of type 'image' in the named collection.
// Cross-ref validator (Step 6) checks field existence and type.
export const MediaTraySchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MediaTray'),
    collectionId: z.string().min(1).max(64),
    imageField: z.string().min(1).max(64),
    aspectRatio: z.enum(['1:1', '4:5', '16:9']).optional(),
    tapAction: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type MediaTray = z.infer<typeof MediaTraySchema>

// ImagePicker — tappable image picker backed by expo-image-picker.
// F-9 (closed): valueBinding uses ImageBinding (not a plain value: string).
export const ImagePickerSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ImagePicker'),
    label: z.string().min(1).max(80),
    valueBinding: ImageBindingSchema,
    source: z.enum(['camera', 'library', 'both']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ImagePicker = z.infer<typeof ImagePickerSchema>
