/**
 * Slot schema tests — T-0005-129..134
 * SlotSchema is the discriminated union used by ListItem.leading/trailing.
 */
import {SlotSchema} from './slot.js'
import {SLOT_NONE, SLOT_ICON, SLOT_AVATAR, SLOT_BADGE} from '../../test/fixtures.js'

describe('SlotSchema — kind discriminated union (F-3 closure)', () => {
  // T-0005-132
  it("accepts kind='none'", () => {
    expect(() => SlotSchema.parse(SLOT_NONE)).not.toThrow()
    expect(SlotSchema.parse(SLOT_NONE).kind).toBe('none')
  })

  // T-0005-129
  it("accepts kind='icon' with a valid icon name", () => {
    expect(() => SlotSchema.parse(SLOT_ICON)).not.toThrow()
    expect(SlotSchema.parse(SLOT_ICON).kind).toBe('icon')
  })

  // T-0005-130
  it("accepts kind='avatar' with a minimal Avatar node", () => {
    expect(() => SlotSchema.parse(SLOT_AVATAR)).not.toThrow()
    expect(SlotSchema.parse(SLOT_AVATAR).kind).toBe('avatar')
  })

  // T-0005-131
  it("accepts kind='badge' with a minimal Badge node", () => {
    expect(() => SlotSchema.parse(SLOT_BADGE)).not.toThrow()
    expect(SlotSchema.parse(SLOT_BADGE).kind).toBe('badge')
  })

  // T-0005-133: Stat is not an allowed slot kind
  it("rejects kind='stat' (Stat is not in the 4-branch slot union)", () => {
    const statSlot = {kind: 'stat', node: {id: 'st1', type: 'Stat', value: '5', label: 'count'}}
    expect(() => SlotSchema.parse(statSlot)).toThrow()
  })

  // T-0005-134: closed-enum rejection — 'invalid-icon' is not in the 80-name catalog.
  // IconNameSchema is now a z.enum([...80 values]); any name outside the closed set fails.
  it("rejects kind='icon' with name='invalid-icon' (T-0005-134 — closed enum)", () => {
    expect(() => SlotSchema.parse({kind: 'icon', name: 'invalid-icon'})).toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() => SlotSchema.parse({kind: 'image'})).toThrow()
  })

  it('rejects missing kind', () => {
    expect(() => SlotSchema.parse({})).toThrow()
  })

  it('rejects icon slot without name', () => {
    expect(() => SlotSchema.parse({kind: 'icon'})).toThrow()
  })

  it('rejects avatar slot without node', () => {
    expect(() => SlotSchema.parse({kind: 'avatar'})).toThrow()
  })

  it('rejects badge slot without node', () => {
    expect(() => SlotSchema.parse({kind: 'badge'})).toThrow()
  })
})
