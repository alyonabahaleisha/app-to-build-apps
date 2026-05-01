import {A2UISpecSchema, A2UI_VERSION} from './index'
import {canonicalize, renderHash} from './canonical'

describe('A2UISpecSchema', () => {
  it('parses a minimal valid spec', () => {
    const spec = {
      version: A2UI_VERSION,
      views: [{id: 'main', root: {type: 'Heading', text: 'Hello'}}],
      initialViewId: 'main',
    }
    expect(() => A2UISpecSchema.parse(spec)).not.toThrow()
  })

  it('rejects spec when initialViewId references a missing view', () => {
    const spec = {
      version: A2UI_VERSION,
      views: [{id: 'main', root: {type: 'Heading', text: 'Hello'}}],
      initialViewId: 'nonexistent',
    }
    expect(() => A2UISpecSchema.parse(spec)).toThrow(/initialViewId/)
  })

  it('rejects unknown component type', () => {
    const spec = {
      version: A2UI_VERSION,
      views: [{id: 'main', root: {type: 'NotARealType', text: 'Hello'}}],
      initialViewId: 'main',
    }
    expect(() => A2UISpecSchema.parse(spec)).toThrow()
  })
})

describe('canonicalize', () => {
  it('produces identical output for differently-keyed equivalent objects', () => {
    const a = {b: 1, a: 2, c: {y: 1, x: 2}}
    const b = {a: 2, c: {x: 2, y: 1}, b: 1}
    expect(canonicalize(a)).toBe(canonicalize(b))
  })

  it('renderHash is deterministic', () => {
    const spec = {version: 1, views: [], initialViewId: 'x'}
    expect(renderHash(spec)).toBe(renderHash({...spec}))
  })
})
