import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePhoneInput } from './usePhoneInput'

const change = (value: string) =>
  ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>

describe('usePhoneInput — Venezuelan mode', () => {
  it('exposes the VE carrier quick-select prefixes', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    expect(result.current.prefixes).toEqual(['0412', '0414', '0424', '0416', '0426', '0422'])
  })

  it('sets the value when a carrier prefix is selected', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    act(() => result.current.onPrefixSelect('0424'))
    expect(result.current.value).toBe('0424')
  })

  it('appends a keypress AFTER a prefix select without corrupting/resetting the prefix (core bug-fix regression proof)', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    act(() => result.current.onPrefixSelect('0424'))
    act(() => result.current.onChange(change('04241')))
    expect(result.current.value).toBe('0424-1')
  })

  it('continues appending subsequent keypresses onto the same growing value, never resetting to a stale value', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    act(() => result.current.onPrefixSelect('0424'))
    act(() => result.current.onChange(change('0424-1')))
    act(() => result.current.onChange(change('0424-12')))
    act(() => result.current.onChange(change('0424-123')))
    expect(result.current.value).toBe('0424-123')
  })

  it('backspace (fewer digits) removes only from the current displayed value, never resurrecting stale digits', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    act(() => result.current.onPrefixSelect('0424'))
    act(() => result.current.onChange(change('0424-12')))
    act(() => result.current.onChange(change('0424-1')))
    expect(result.current.value).toBe('0424-1')
  })

  it('isValid reflects isValidVenezuelanPhone for the current value', () => {
    const { result } = renderHook(() => usePhoneInput(true))
    expect(result.current.isValid).toBe(false)
    act(() => result.current.onPrefixSelect('0424'))
    act(() => result.current.onChange(change('04241234567')))
    expect(result.current.value).toBe('0424-1234-567')
    expect(result.current.isValid).toBe(true)
  })
})

describe('usePhoneInput — international mode', () => {
  it('exposes no quick-select prefixes (the leading + is auto-added by formatting)', () => {
    const { result } = renderHook(() => usePhoneInput(false))
    expect(result.current.prefixes).toEqual([])
  })

  it('auto-prepends + and appends typed digits', () => {
    const { result } = renderHook(() => usePhoneInput(false))
    act(() => result.current.onChange(change('573101234567')))
    expect(result.current.value).toBe('+573101234567')
  })

  it('isValid reflects isValidInternationalPhone for the current value', () => {
    const { result } = renderHook(() => usePhoneInput(false))
    act(() => result.current.onChange(change('123456')))
    expect(result.current.isValid).toBe(false)
    act(() => result.current.onChange(change('1234567')))
    expect(result.current.isValid).toBe(true)
  })
})

describe('usePhoneInput — mode switching does not carry over formatting', () => {
  it('resets the value when isVenezuelan flips', () => {
    const { result, rerender } = renderHook(({ isVenezuelan }) => usePhoneInput(isVenezuelan), {
      initialProps: { isVenezuelan: true }
    })
    act(() => result.current.onPrefixSelect('0424'))
    act(() => result.current.onChange(change('0424-1')))
    expect(result.current.value).toBe('0424-1')

    rerender({ isVenezuelan: false })
    expect(result.current.value).toBe('')
    expect(result.current.prefixes).toEqual([])
  })
})
