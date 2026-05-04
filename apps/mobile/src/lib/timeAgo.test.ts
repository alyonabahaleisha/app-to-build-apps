/**
 * timeAgo tests — small pure-function unit; bonus, not in the 17 mandatory
 * Step 7 T-IDs. Verifies Sable's deck phrasings.
 */
import {timeAgo} from './timeAgo'

const NOW = new Date('2026-05-01T12:00:00Z')

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms)
}

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

describe('timeAgo', () => {
  it('< 1 minute → "just now"', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now')
    expect(timeAgo(ago(30 * SECOND), NOW)).toBe('just now')
  })

  it('1 minute → "a minute ago" (singular)', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('a minute ago')
  })

  it('5 minutes → "5 minutes ago"', () => {
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe('5 minutes ago')
  })

  it('1 hour → "an hour ago"', () => {
    expect(timeAgo(ago(HOUR), NOW)).toBe('an hour ago')
  })

  it('3 hours → "3 hours ago"', () => {
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe('3 hours ago')
  })

  it('30 hours → "yesterday"', () => {
    expect(timeAgo(ago(30 * HOUR), NOW)).toBe('yesterday')
  })

  it('3 days → "3 days ago"', () => {
    expect(timeAgo(ago(3 * DAY), NOW)).toBe('3 days ago')
  })

  it('10 days → "a week ago"', () => {
    expect(timeAgo(ago(10 * DAY), NOW)).toBe('a week ago')
  })

  it('3 weeks → "3 weeks ago"', () => {
    expect(timeAgo(ago(3 * WEEK), NOW)).toBe('3 weeks ago')
  })

  it('accepts ISO strings', () => {
    expect(timeAgo(ago(MINUTE).toISOString(), NOW)).toBe('a minute ago')
  })

  it('invalid date → "just now"', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('just now')
  })

  it('future date → "just now" (no negative branch)', () => {
    expect(timeAgo(new Date(NOW.getTime() + 10_000), NOW)).toBe('just now')
  })
})
