/**
 * ListItemContext tests
 * T-0006-017 (context machinery — row resolution tested via useBinding.test.tsx)
 */
import React from 'react'
import {renderHook} from '@testing-library/react-native'
import {useListItemContext, ListItemContextProvider} from './ListItemContext'

describe('ListItemContext', () => {
  it('returns null outside a ListItemContextProvider', () => {
    const {result} = renderHook(() => useListItemContext())
    expect(result.current).toBeNull()
  })

  it('returns the row value inside a ListItemContextProvider', () => {
    const row = {name: 'Test', reps: 5}
    const value = {row, rowId: 'row1', index: 0}

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ListItemContextProvider value={value}>{children}</ListItemContextProvider>
    )

    const {result} = renderHook(() => useListItemContext(), {wrapper})
    expect(result.current).toEqual(value)
    expect(result.current!.row['name']).toBe('Test')
    expect(result.current!.rowId).toBe('row1')
    expect(result.current!.index).toBe(0)
  })

  it('nested providers provide the innermost value', () => {
    const outerRow = {name: 'Outer'}
    const innerRow = {name: 'Inner'}

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ListItemContextProvider value={{row: outerRow, rowId: 'outer', index: 0}}>
        <ListItemContextProvider value={{row: innerRow, rowId: 'inner', index: 1}}>
          {children}
        </ListItemContextProvider>
      </ListItemContextProvider>
    )

    const {result} = renderHook(() => useListItemContext(), {wrapper})
    expect(result.current!.row['name']).toBe('Inner')
    expect(result.current!.rowId).toBe('inner')
  })
})
