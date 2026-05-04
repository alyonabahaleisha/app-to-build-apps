/**
 * T-0002-022 through T-0002-026
 * Config exhaustion tests for the anthropic singleton module.
 *
 * Uses jest.isolateModules to reload the module under different env values.
 * Because isolateModules creates a fresh module registry, the EnvMissingError
 * thrown inside the fresh require() is a different class instance than the one
 * imported at the top of this file. We check error shape (name + message) instead
 * of instanceof to avoid cross-registry class identity failures.
 */

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    beta: {promptCaching: {messages: {stream: jest.fn()}}},
  }))
})

describe('anthropic singleton', () => {
  const originalEnv = process.env['ANTHROPIC_API_KEY']

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['ANTHROPIC_API_KEY']
    } else {
      process.env['ANTHROPIC_API_KEY'] = originalEnv
    }
    jest.resetModules()
  })

  function tryLoadAnthropicModule(): Error | null {
    let caught: Error | null = null
    jest.isolateModules(() => {
      try {
        // jest.isolateModules requires CommonJS require() to reload a fresh module copy.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./anthropic.js')
      } catch (err) {
        caught = err as Error
      }
    })
    return caught
  }

  // T-0002-022
  it('throws EnvMissingError when ANTHROPIC_API_KEY is unset', () => {
    delete process.env['ANTHROPIC_API_KEY']
    const err = tryLoadAnthropicModule()
    expect(err).not.toBeNull()
    expect(err?.name).toBe('EnvMissingError')
    expect(err?.message).toContain('ANTHROPIC_API_KEY')
  })

  // T-0002-023
  it('throws EnvMissingError when ANTHROPIC_API_KEY is empty string', () => {
    process.env['ANTHROPIC_API_KEY'] = ''
    const err = tryLoadAnthropicModule()
    expect(err).not.toBeNull()
    expect(err?.name).toBe('EnvMissingError')
    expect(err?.message).toContain('ANTHROPIC_API_KEY')
  })

  // T-0002-024
  it('throws EnvMissingError when ANTHROPIC_API_KEY is whitespace only', () => {
    process.env['ANTHROPIC_API_KEY'] = '   '
    const err = tryLoadAnthropicModule()
    expect(err).not.toBeNull()
    expect(err?.name).toBe('EnvMissingError')
    expect(err?.message).toContain('ANTHROPIC_API_KEY')
  })

  // T-0002-025
  it('loads cleanly when ANTHROPIC_API_KEY has a valid format', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-validkey'
    const err = tryLoadAnthropicModule()
    expect(err).toBeNull()
  })

  // T-0002-026
  it('loads cleanly when ANTHROPIC_API_KEY is an arbitrary non-empty string (no format check)', () => {
    process.env['ANTHROPIC_API_KEY'] = 'garbage'
    const err = tryLoadAnthropicModule()
    expect(err).toBeNull()
  })
})
