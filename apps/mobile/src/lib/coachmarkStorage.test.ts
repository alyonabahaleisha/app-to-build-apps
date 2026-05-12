/**
 * coachmarkStorage tests — ADR-0011 Step 10.
 * T-0011-283: markCoachmarkSeen writes to SecureStore.
 * T-0011-284: hasSeenCoachmark reads from SecureStore.
 */

// ---- expo-secure-store mock ------------------------------------------------

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>()
  return {
    __mem: mem,
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mem.set(k, v)
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      mem.delete(k)
    }),
  }
})

// ---- Imports ---------------------------------------------------------------

import {hasSeenCoachmark, markCoachmarkSeen} from './coachmarkStorage'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStoreMock = require('expo-secure-store') as {
  __mem: Map<string, string>
  getItemAsync: jest.Mock
  setItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}

// ---- Setup -----------------------------------------------------------------

beforeEach(() => {
  SecureStoreMock.__mem.clear()
  SecureStoreMock.getItemAsync.mockClear()
  SecureStoreMock.setItemAsync.mockClear()
})

// ---- Tests -----------------------------------------------------------------

describe('hasSeenCoachmark', () => {
  it('T-0011-284: returns false when key is not set', async () => {
    const result = await hasSeenCoachmark()
    expect(result).toBe(false)
  })

  it('T-0011-284: returns true when key is "true"', async () => {
    SecureStoreMock.__mem.set('coachmark_share_seen', 'true')
    const result = await hasSeenCoachmark()
    expect(result).toBe(true)
  })

  it('T-0011-284: returns false when SecureStore.getItemAsync throws', async () => {
    SecureStoreMock.getItemAsync.mockRejectedValueOnce(new Error('keychain error'))
    const result = await hasSeenCoachmark()
    expect(result).toBe(false)
  })
})

describe('markCoachmarkSeen', () => {
  it('T-0011-283: writes "true" to SecureStore under coachmark_share_seen key', async () => {
    await markCoachmarkSeen()
    expect(SecureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'coachmark_share_seen',
      'true',
    )
    expect(SecureStoreMock.__mem.get('coachmark_share_seen')).toBe('true')
  })

  it('T-0011-283: after markCoachmarkSeen, hasSeenCoachmark returns true', async () => {
    await markCoachmarkSeen()
    const result = await hasSeenCoachmark()
    expect(result).toBe(true)
  })

  it('T-0011-268: does not throw if SecureStore.setItemAsync throws', async () => {
    SecureStoreMock.setItemAsync.mockRejectedValueOnce(new Error('write failure'))
    await expect(markCoachmarkSeen()).resolves.toBeUndefined()
  })
})
