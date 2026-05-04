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
    super(code === 'no_tool_use' ? 'Anthropic response contained no tool_use block' : 'LLM output failed A2UISpecSchema validation')
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
