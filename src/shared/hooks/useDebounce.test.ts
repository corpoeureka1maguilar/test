import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 300))
    expect(result.current).toBe('a')
  })

  it('does not update before the delay elapses', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), { initialProps: { value: 'a' } })
    rerender({ value: 'b' })
    await act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('a')
  })

  it('updates to the latest value once the delay elapses', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), { initialProps: { value: 'a' } })
    rerender({ value: 'b' })
    await act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('b')
  })

  it('resets the timer when the value changes again before the delay elapses', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), { initialProps: { value: 'a' } })
    rerender({ value: 'b' })
    await act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'c' })
    await act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a')
    await act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('c')
  })
})
