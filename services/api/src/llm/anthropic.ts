/**
 * Singleton Anthropic SDK client.
 *
 * Throws EnvMissingError at module load when ANTHROPIC_API_KEY is absent,
 * empty, or whitespace-only. No call site may instantiate new Anthropic().
 */
import Anthropic from '@anthropic-ai/sdk'
import {EnvMissingError} from './errors.js'

function requireApiKey(): string {
  const raw = process.env['ANTHROPIC_API_KEY']
  if (!raw || raw.trim().length === 0) {
    throw new EnvMissingError('ANTHROPIC_API_KEY')
  }
  return raw
}

export const anthropic = new Anthropic({apiKey: requireApiKey()})
