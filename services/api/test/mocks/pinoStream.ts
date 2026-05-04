/**
 * Pino test stream — captures structured log records into an in-memory array
 * for assertion. Per ADR-0001 §Test Helpers, used by T-0001-024 / T-0001-025
 * (Step 2) and later T-0001-040 / T-0001-043 / T-0001-082 / T-0001-120.
 *
 * Usage:
 *
 *   const sink = createLogSink()
 *   const server = await buildServer({loggerStream: sink.stream})
 *   await server.inject({...})
 *   expect(sink.records.some((r) => r.msg.includes('foo'))).toBe(false)
 *
 * Pino writes one JSON-encoded record per `\n`-terminated chunk.
 */
import type {Writable} from 'node:stream'
import {Writable as WritableImpl} from 'node:stream'

export interface LogRecord {
  level: number
  time?: number
  msg?: string
  [key: string]: unknown
}

export interface LogSink {
  /** Pass to Fastify's `loggerStream` / pino constructor as the destination. */
  stream: Writable
  /** Captured records, in arrival order. */
  records: LogRecord[]
  /** Raw JSON chunks for non-record-level inspection. */
  raw: string[]
  /** Test convenience: any record whose serialized form contains `needle`. */
  containsSubstring: (needle: string) => boolean
  /** Filter records by Pino numeric level (info=30, error=50). */
  byLevel: (level: number) => LogRecord[]
}

export function createLogSink(): LogSink {
  const records: LogRecord[] = []
  const raw: string[] = []

  const stream = new WritableImpl({
    write(chunk, _encoding, cb) {
      const text = chunk.toString()
      raw.push(text)
      // Pino writes one record per newline. A single chunk may carry several.
      for (const line of text.split('\n')) {
        if (!line) continue
        try {
          records.push(JSON.parse(line) as LogRecord)
        } catch {
          // Non-JSON line — keep it in raw[] but don't attempt to parse.
        }
      }
      cb()
    },
  })

  return {
    stream,
    records,
    raw,
    containsSubstring(needle: string): boolean {
      if (needle === '') return false
      return raw.some((line) => line.includes(needle))
    },
    byLevel(level: number): LogRecord[] {
      return records.filter((r) => r.level === level)
    },
  }
}

/** Pino numeric levels — exported for clarity at call sites. */
export const PINO_LEVEL = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
} as const
