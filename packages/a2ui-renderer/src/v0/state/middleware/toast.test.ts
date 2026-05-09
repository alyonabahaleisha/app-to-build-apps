/**
 * toast middleware tests — T-0006-020
 */
import {makeToastMiddleware} from './toast'

describe('toast middleware (T-0006-020)', () => {
  it('calls host.onToast with message and tone, does NOT call next', () => {
    const onToast = jest.fn()
    const next = jest.fn()
    const mw = makeToastMiddleware({onToast})

    mw({type: 'toast', message: 'Saved!', tone: 'success'}, next)

    expect(onToast).toHaveBeenCalledWith('Saved!', 'success')
    expect(next).not.toHaveBeenCalled()
  })

  it('calls host.onToast with undefined tone when tone is absent', () => {
    const onToast = jest.fn()
    const next = jest.fn()
    const mw = makeToastMiddleware({onToast})

    mw({type: 'toast', message: 'Info'}, next)

    expect(onToast).toHaveBeenCalledWith('Info', undefined)
    expect(next).not.toHaveBeenCalled()
  })

  it('passes non-toast actions through to next', () => {
    const onToast = jest.fn()
    const next = jest.fn()
    const mw = makeToastMiddleware({onToast})

    mw({type: 'set', target: 'x', value: 1}, next)

    expect(onToast).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith({type: 'set', target: 'x', value: 1})
  })
})
