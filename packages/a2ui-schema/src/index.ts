import {z} from 'zod'

export const A2UI_VERSION = 1 as const

const A2UIValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type A2UIValue = z.infer<typeof A2UIValueSchema>

export const A2UIActionSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('set'), targetId: z.string(), value: A2UIValueSchema}),
  z.object({type: z.literal('increment'), targetId: z.string(), by: z.number().optional()}),
  z.object({type: z.literal('decrement'), targetId: z.string(), by: z.number().optional()}),
  z.object({type: z.literal('toast'), message: z.string()}),
  z.object({type: z.literal('navigate'), viewId: z.string()}),
])
export type A2UIAction = z.infer<typeof A2UIActionSchema>

const baseNode = {
  id: z.string().optional(),
}

const HeadingSchema = z.object({
  ...baseNode,
  type: z.literal('Heading'),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
})

const TextSchema = z.object({
  ...baseNode,
  type: z.literal('Text'),
  text: z.string(),
  weight: z.enum(['normal', 'bold']).optional(),
  color: z.enum(['primary', 'muted', 'destructive']).optional(),
})

const ImageSchema = z.object({
  ...baseNode,
  type: z.literal('Image'),
  src: z.string(),
  aspectRatio: z.number().positive().optional(),
  alt: z.string().optional(),
})

const ButtonSchema = z.object({
  ...baseNode,
  type: z.literal('Button'),
  label: z.string(),
  action: A2UIActionSchema,
  variant: z.enum(['primary', 'secondary', 'destructive']).optional(),
})

const TextInputSchema = z.object({
  type: z.literal('TextInput'),
  id: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  multiline: z.boolean().optional(),
})

const ToggleSchema = z.object({
  type: z.literal('Toggle'),
  id: z.string(),
  label: z.string(),
  defaultValue: z.boolean().optional(),
})

const CounterSchema = z.object({
  type: z.literal('Counter'),
  id: z.string(),
  label: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
})

// Recursive nodes (List, Form, Container) declared via z.lazy.
export type A2UINode =
  | z.infer<typeof HeadingSchema>
  | z.infer<typeof TextSchema>
  | z.infer<typeof ImageSchema>
  | z.infer<typeof ButtonSchema>
  | z.infer<typeof TextInputSchema>
  | z.infer<typeof ToggleSchema>
  | z.infer<typeof CounterSchema>
  | {id?: string; type: 'List'; items: A2UINode[]; separator?: boolean}
  | {
      id?: string
      type: 'Form'
      formId: string
      fields: A2UINode[]
      submitLabel?: string
      submitAction?: A2UIAction
    }
  | {
      id?: string
      type: 'Container'
      direction: 'row' | 'column'
      children: A2UINode[]
      padding?: 'none' | 'sm' | 'md' | 'lg'
      gap?: 'none' | 'sm' | 'md' | 'lg'
      align?: 'start' | 'center' | 'end' | 'stretch'
      justify?: 'start' | 'center' | 'end' | 'between'
    }

export const A2UINodeSchema: z.ZodType<A2UINode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    HeadingSchema,
    TextSchema,
    ImageSchema,
    ButtonSchema,
    TextInputSchema,
    ToggleSchema,
    CounterSchema,
    z.object({
      id: z.string().optional(),
      type: z.literal('List'),
      items: z.array(A2UINodeSchema),
      separator: z.boolean().optional(),
    }),
    z.object({
      id: z.string().optional(),
      type: z.literal('Form'),
      formId: z.string(),
      fields: z.array(A2UINodeSchema),
      submitLabel: z.string().optional(),
      submitAction: A2UIActionSchema.optional(),
    }),
    z.object({
      id: z.string().optional(),
      type: z.literal('Container'),
      direction: z.enum(['row', 'column']),
      children: z.array(A2UINodeSchema),
      padding: z.enum(['none', 'sm', 'md', 'lg']).optional(),
      gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
      align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      justify: z.enum(['start', 'center', 'end', 'between']).optional(),
    }),
  ]),
)

export const A2UIViewSchema = z.object({
  id: z.string(),
  root: A2UINodeSchema,
})
export type A2UIView = z.infer<typeof A2UIViewSchema>

export const A2UISpecSchema = z
  .object({
    version: z.literal(A2UI_VERSION),
    views: z.array(A2UIViewSchema).min(1),
    initialViewId: z.string(),
    initialState: z.record(z.string(), A2UIValueSchema).optional(),
  })
  .superRefine((spec, ctx) => {
    const viewIds = new Set(spec.views.map(v => v.id))
    if (!viewIds.has(spec.initialViewId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `initialViewId "${spec.initialViewId}" is not a known view`,
        path: ['initialViewId'],
      })
    }
  })
export type A2UISpec = z.infer<typeof A2UISpecSchema>

// JSON Patch — minimal RFC 6902 shape. Used by the edit tool.
export const JsonPatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
  path: z.string(),
  value: z.unknown().optional(),
  from: z.string().optional(),
})
export const JsonPatchSchema = z.array(JsonPatchOperationSchema)
export type JsonPatch = z.infer<typeof JsonPatchSchema>
