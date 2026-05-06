import {z} from 'zod'

export const PLAN_VERSION = 1 as const

export const PlanArchetypeSchema = z.enum([
  'ListCRUD',
  'Tracker',
  'Calculator',
  'Journal',
  'Dashboard',
  'SocialFeed',
  'InfoDisplay',
  'SimpleGame',
  'unknown',
])
export type PlanArchetype = z.infer<typeof PlanArchetypeSchema>

export const PlanNavigationSchema = z.enum(['none', 'stack', 'tabs', 'tabs+stack', 'modal-overlay'])

export const PlanScreenSchema = z.object({
  // Must start with a lowercase letter, followed by up to 31 lowercase letters, digits, or underscores.
  // Stable string ids are required — the builder uses them verbatim as view ids.
  id: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
  role: z.string().min(1).max(40),
  purpose: z.string().min(1).max(200),
  // Element-level .min(1) prevents empty-string component names (rev-1 Roz finding).
  key_components: z.array(z.string().min(1)).min(1).max(8),
})

export const PlanEditIntentSchema = z.object({
  // Each path must be a JSON Pointer (RFC 6901) that starts with '/'.
  // Root pointer '/' is rejected — it would functionally disable the scope guard
  // because every path is a descendant of root (rev-1 Roz finding).
  target_paths: z
    .array(
      z
        .string()
        .startsWith('/')
        .refine(p => p !== '/', 'root pointer disables scope guard'),
    )
    .min(1)
    .max(20),
})

export const PlanSchema = z
  .object({
    version: z.literal(PLAN_VERSION),
    archetype: PlanArchetypeSchema,
    screens: z.array(PlanScreenSchema).min(1).max(4),
    navigation: PlanNavigationSchema,
    edit_intent: PlanEditIntentSchema.optional(),
  })
  .superRefine((plan, ctx) => {
    // 'none' navigation is only valid for single-screen apps.
    if (plan.navigation === 'none' && plan.screens.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "navigation 'none' requires exactly one screen",
        path: ['navigation'],
      })
    }
    // Screen ids must be unique across the plan.
    const ids = new Set(plan.screens.map(s => s.id))
    if (ids.size !== plan.screens.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'screen ids must be unique',
        path: ['screens'],
      })
    }
  })

export type Plan = z.infer<typeof PlanSchema>
