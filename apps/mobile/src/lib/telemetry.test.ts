/**
 * Mobile telemetry whitelist tests — ADR-0008 Step 7.
 *
 * T-IDs covered:
 *   T-0008-152b — share_link_copied: valid payload accepted (no throw)
 *   T-0008-152c — share_link_copied: invalid key rejected (MobileEventPayloadValidationError)
 *   T-0008-152d — link_clone_opened: valid payload accepted (no throw)
 *   T-0008-152e — link_clone_opened: invalid key rejected
 *
 * Additional coverage:
 *   - MOBILE_EVENT_PAYLOAD_WHITELIST contains exactly the 2 ADR-0008 event types
 *   - Whitelist independence (key in share_link_copied not auto-allowed in link_clone_opened)
 *   - PII keys rejected on both event types (email, sub, share_id full token)
 *   - Regression: existing RunScreen spy contract preserved (writeEvent is still synchronous)
 *
 * No network calls, no mocked modules needed — the module is a pure synchronous writer.
 */

import {
  writeEvent,
  MobileEventPayloadValidationError,
  MOBILE_EVENT_PAYLOAD_WHITELIST,
  type MobileEventType,
} from './telemetry'

// ---------------------------------------------------------------------------
// MOBILE_EVENT_PAYLOAD_WHITELIST coverage
// ---------------------------------------------------------------------------

describe('MOBILE_EVENT_PAYLOAD_WHITELIST contains exactly the ADR-0008 event types', () => {
  const EXPECTED_TYPES: MobileEventType[] = ['share_link_copied', 'link_clone_opened']

  it('has exactly 2 event types', () => {
    expect(Object.keys(MOBILE_EVENT_PAYLOAD_WHITELIST)).toHaveLength(2)
  })

  for (const eventType of EXPECTED_TYPES) {
    it(`${eventType} is present with a non-empty whitelist`, () => {
      expect(Object.keys(MOBILE_EVENT_PAYLOAD_WHITELIST)).toContain(eventType)
      expect(
        (MOBILE_EVENT_PAYLOAD_WHITELIST[eventType] as ReadonlyArray<string>).length,
      ).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// T-0008-152b — share_link_copied: valid payload accepted
// ---------------------------------------------------------------------------

describe("T-0008-152b: writeEvent('share_link_copied', valid payload) — does not throw", () => {
  it('share_link_copied with whitelisted share_id_prefix succeeds', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', share_id_prefix: 'aBcD'}),
    ).not.toThrow()
  })

  it('share_link_copied with empty payload succeeds (no required keys)', () => {
    expect(() => writeEvent({eventType: 'share_link_copied'})).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0008-152c — share_link_copied: invalid key throws MobileEventPayloadValidationError
// ---------------------------------------------------------------------------

describe('T-0008-152c: writeEvent — share_link_copied rejects unknown keys', () => {
  it('invalid_key throws MobileEventPayloadValidationError synchronously', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', invalid_key: 'x'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('email key throws (PII — not whitelisted)', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', email: 'user@example.com'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('sub key throws (Apple sub — not whitelisted)', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', sub: 'apple-sub-id'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('full share_id key throws (full token is not whitelisted — only prefix)', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', share_id: 'full24charXXXXXXXXXXXXXX'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('mode key throws on share_link_copied (allowed only on link_clone_opened)', () => {
    expect(() =>
      writeEvent({eventType: 'share_link_copied', mode: 'view'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('error message identifies the offending key', () => {
    let caught: unknown
    try {
      writeEvent({eventType: 'share_link_copied', bad_key: 'leak'})
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(MobileEventPayloadValidationError)
    const e = caught as MobileEventPayloadValidationError
    expect(e.offendingKey).toBe('bad_key')
    expect(e.eventType).toBe('share_link_copied')
    expect(e.message).toContain('bad_key')
    expect(e.message).toContain('share_link_copied')
  })
})

// ---------------------------------------------------------------------------
// T-0008-152d — link_clone_opened: valid payload accepted
// ---------------------------------------------------------------------------

describe("T-0008-152d: writeEvent('link_clone_opened', valid payload) — does not throw", () => {
  it('link_clone_opened with share_id_prefix only succeeds', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', share_id_prefix: 'aBcD'}),
    ).not.toThrow()
  })

  it('link_clone_opened with share_id_prefix + mode succeeds', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', share_id_prefix: 'aBcD', mode: 'clone'}),
    ).not.toThrow()
  })

  it('link_clone_opened with empty payload succeeds (no required keys)', () => {
    expect(() => writeEvent({eventType: 'link_clone_opened'})).not.toThrow()
  })

  it("mode: 'remix' is accepted (not value-validated — whitelist is key-based)", () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', mode: 'remix'}),
    ).not.toThrow()
  })

  it("mode: 'view' is accepted (key-based whitelist, value is caller's responsibility)", () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', mode: 'view'}),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0008-152e — link_clone_opened: invalid key throws
// ---------------------------------------------------------------------------

describe('T-0008-152e: writeEvent — link_clone_opened rejects unknown keys', () => {
  it('extra_key throws MobileEventPayloadValidationError', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', extra_key: 'x'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('email key throws (PII — not whitelisted)', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', email: 'user@example.com'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('source_archetype key throws (server-side key — not on client whitelist)', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', source_archetype: 'productivity'}),
    ).toThrow(MobileEventPayloadValidationError)
  })

  it('idempotent_hit key throws (server-side key — not on client whitelist)', () => {
    expect(() =>
      writeEvent({eventType: 'link_clone_opened', idempotent_hit: false}),
    ).toThrow(MobileEventPayloadValidationError)
  })
})

// ---------------------------------------------------------------------------
// Whitelist independence — key in one event type is NOT auto-allowed on another
// ---------------------------------------------------------------------------

describe('whitelist independence — share_link_copied and link_clone_opened are isolated', () => {
  it('mode key is whitelisted on link_clone_opened but NOT on share_link_copied', () => {
    const cloneOpenedAllowed = MOBILE_EVENT_PAYLOAD_WHITELIST[
      'link_clone_opened'
    ] as ReadonlyArray<string>
    const copiedAllowed = MOBILE_EVENT_PAYLOAD_WHITELIST[
      'share_link_copied'
    ] as ReadonlyArray<string>
    expect(cloneOpenedAllowed).toContain('mode')
    expect(copiedAllowed).not.toContain('mode')
  })

  it('share_id_prefix is whitelisted on both event types', () => {
    expect(
      MOBILE_EVENT_PAYLOAD_WHITELIST['share_link_copied'] as ReadonlyArray<string>,
    ).toContain('share_id_prefix')
    expect(
      MOBILE_EVENT_PAYLOAD_WHITELIST['link_clone_opened'] as ReadonlyArray<string>,
    ).toContain('share_id_prefix')
  })
})

// ---------------------------------------------------------------------------
// Regression: writeEvent is synchronous — existing spy contract preserved
// ---------------------------------------------------------------------------

describe('Regression: writeEvent is synchronous (existing RunScreen test spy contract)', () => {
  it('writeEvent does not return a Promise', () => {
    const result = writeEvent({eventType: 'share_link_copied', share_id_prefix: 'aBcD'})
    expect(result).toBeUndefined()
  })

  it('writeEvent throws synchronously (not asynchronously) on whitelist violation', () => {
    // Confirms the spy pattern from RunScreen.test.tsx still works:
    // jest.fn() capturing calls, not awaiting a rejected promise.
    let threw = false
    try {
      writeEvent({eventType: 'share_link_copied', bad_key: 'x'})
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// MobileEventPayloadValidationError shape
// ---------------------------------------------------------------------------

describe('MobileEventPayloadValidationError — error shape', () => {
  it('has code === mobile_event_payload_validation', () => {
    const err = new MobileEventPayloadValidationError('share_link_copied', 'bad')
    expect(err.code).toBe('mobile_event_payload_validation')
  })

  it('has name === MobileEventPayloadValidationError', () => {
    const err = new MobileEventPayloadValidationError('share_link_copied', 'bad')
    expect(err.name).toBe('MobileEventPayloadValidationError')
  })

  it('is instanceof Error', () => {
    const err = new MobileEventPayloadValidationError('share_link_copied', 'bad')
    expect(err).toBeInstanceOf(Error)
  })
})
