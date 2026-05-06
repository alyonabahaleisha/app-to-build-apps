/**
 * Typed errors for the LLM module. Each has a stable `code` string so callers
 * can pattern-match without inspecting messages (which may change).
 */

export class EnvMissingError extends Error {
  readonly code = 'env_missing' as const

  constructor(varName: string) {
    super(`Environment variable ${varName} is required but missing or blank`)
    this.name = 'EnvMissingError'
  }
}

export class InvalidSpecError extends Error {
  readonly code: 'invalid_spec' | 'no_tool_use'
  readonly detail?: unknown

  constructor(code: 'invalid_spec' | 'no_tool_use', detail?: unknown) {
    super(
      code === 'no_tool_use'
        ? 'Anthropic response contained no tool_use block'
        : 'LLM output failed A2UISpecSchema validation',
    )
    this.name = 'InvalidSpecError'
    this.code = code
    this.detail = detail
  }
}

export class RateLimitedError extends Error {
  readonly code = 'rate_limited' as const

  constructor() {
    super('Anthropic API rate limit exceeded after retries')
    this.name = 'RateLimitedError'
  }
}

export class AnthropicTransportError extends Error {
  readonly code = 'transport_error' as const

  constructor(safeMsg: string) {
    super(safeMsg)
    this.name = 'AnthropicTransportError'
  }
}

export class PlannerInvalidError extends Error {
  readonly code: 'no_tool_use' | 'invalid_plan'
  readonly detail?: unknown

  constructor(code: 'no_tool_use' | 'invalid_plan', detail?: unknown) {
    super(
      code === 'no_tool_use'
        ? 'Planner response contained no tool_use block'
        : 'Planner output failed PlanSchema validation after retry',
    )
    this.name = 'PlannerInvalidError'
    this.code = code
    this.detail = detail
  }
}

export class PlannerTimeoutError extends Error {
  readonly code = 'planner_timeout' as const

  constructor() {
    super('Planner call aborted — timeout exceeded')
    this.name = 'PlannerTimeoutError'
  }
}

export class PlannerTransportError extends Error {
  readonly code = 'planner_transport' as const

  constructor(safeMsg: string) {
    super(safeMsg)
    this.name = 'PlannerTransportError'
  }
}

export class PlanConformanceError extends Error {
  readonly code = 'plan_conformance' as const

  constructor(public readonly reason: string) {
    super(`Builder spec did not conform to plan: ${reason}`)
    this.name = 'PlanConformanceError'
  }
}

export class PatchOutOfScopeError extends Error {
  readonly code = 'patch_out_of_scope' as const

  constructor(
    public readonly offendingOpIndex: number,
    public readonly reason: string,
  ) {
    super(`Patch op at index ${offendingOpIndex} is outside edit_intent.target_paths: ${reason}`)
    this.name = 'PatchOutOfScopeError'
  }
}
