import {z} from 'zod'

export const EVENT_TYPES = [
  'app_install',
  'auth_signup',
  'prompt_submitted',
  'generation_started',
  'generation_succeeded',
  'generation_failed',
  'app_opened',
  'app_edited',
  'project_deleted',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  user_id: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})
export type AppEvent = z.infer<typeof EventSchema>
