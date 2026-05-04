/**
 * Tests for RendererLoggerProvider and useRendererLogger.
 *
 * T-0003-019: RendererLoggerProvider exposes the provided logger via useRendererLogger()
 * T-0003-020: useRendererLogger() outside the provider returns a no-op logger (calling .warn doesn't throw)
 */
import {renderHook} from '@testing-library/react-native'
import React from 'react'

import {RendererLoggerProvider, useRendererLogger} from './RendererLoggerProvider'
import type {RendererLogger} from '../types'

// -- Tests --------------------------------------------------------------------

describe('RendererLoggerProvider', () => {
  // T-0003-019
  it('exposes the provided logger via useRendererLogger()', () => {
    const logger: RendererLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    }
    const {result} = renderHook(() => useRendererLogger(), {
      wrapper: ({children}) => (
        <RendererLoggerProvider logger={logger}>{children}</RendererLoggerProvider>
      ),
    })
    expect(result.current).toBe(logger)
  })

  it('injected logger.warn is callable with message and fields', () => {
    const logger: RendererLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    }
    const {result} = renderHook(() => useRendererLogger(), {
      wrapper: ({children}) => (
        <RendererLoggerProvider logger={logger}>{children}</RendererLoggerProvider>
      ),
    })
    result.current.warn('test message', {key: 'value'})
    expect(logger.warn).toHaveBeenCalledWith('test message', {key: 'value'})
  })

  it('injected logger.error is callable with message and fields', () => {
    const logger: RendererLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    }
    const {result} = renderHook(() => useRendererLogger(), {
      wrapper: ({children}) => (
        <RendererLoggerProvider logger={logger}>{children}</RendererLoggerProvider>
      ),
    })
    result.current.error('something broke', {code: 42})
    expect(logger.error).toHaveBeenCalledWith('something broke', {code: 42})
  })

  // T-0003-020
  it('useRendererLogger() outside provider returns a no-op logger — calling .warn does not throw', () => {
    const {result} = renderHook(() => useRendererLogger())
    // Should not throw.
    expect(() => result.current.warn('safe')).not.toThrow()
    expect(() => result.current.error('safe')).not.toThrow()
    // No-op: no side effects.
    expect(() => result.current.warn('msg', {field: 'value'})).not.toThrow()
  })

  it('no-op logger has warn and error methods', () => {
    const {result} = renderHook(() => useRendererLogger())
    expect(typeof result.current.warn).toBe('function')
    expect(typeof result.current.error).toBe('function')
  })
})
