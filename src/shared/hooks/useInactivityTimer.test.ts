import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInactivityTimer } from './useInactivityTimer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useInactivityTimer', () => {
  it('calls onInactive after the delay with no activity', () => {
    const onInactive = vi.fn()
    renderHook(() => useInactivityTimer(1000, onInactive))
    vi.advanceTimersByTime(1000)
    expect(onInactive).toHaveBeenCalledTimes(1)
  })

  it('resets the timer when a tracked event fires before the delay elapses', () => {
    const onInactive = vi.fn()
    renderHook(() => useInactivityTimer(1000, onInactive))

    vi.advanceTimersByTime(700)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(700)
    expect(onInactive).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(onInactive).toHaveBeenCalledTimes(1)
  })

  it('stops calling onInactive after unmount', () => {
    const onInactive = vi.fn()
    const { unmount } = renderHook(() => useInactivityTimer(1000, onInactive))
    unmount()
    vi.advanceTimersByTime(2000)
    expect(onInactive).not.toHaveBeenCalled()
  })

  it('restarts the timer when delayMs changes', () => {
    const onInactive = vi.fn()
    const { rerender } = renderHook(({ delay }) => useInactivityTimer(delay, onInactive), { initialProps: { delay: 1000 } })
    vi.advanceTimersByTime(900)
    rerender({ delay: 2000 })
    vi.advanceTimersByTime(900)
    expect(onInactive).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1100)
    expect(onInactive).toHaveBeenCalledTimes(1)
  })
})
