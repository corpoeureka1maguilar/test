import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AppInactivityModal } from './AppInactivityModal'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AppInactivityModal', () => {
  it('shows the initial countdown', () => {
    render(<AppInactivityModal seconds={30} onContinue={vi.fn()} onTimeout={vi.fn()} />)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('decrements the countdown every second', () => {
    render(<AppInactivityModal seconds={30} onContinue={vi.fn()} onTimeout={vi.fn()} />)
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('27')).toBeInTheDocument()
  })

  it('calls onTimeout when the countdown reaches zero', () => {
    const onTimeout = vi.fn()
    render(<AppInactivityModal seconds={5} onContinue={vi.fn()} onTimeout={onTimeout} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('calls onContinue when the button is pressed and does not time out', () => {
    const onContinue = vi.fn()
    const onTimeout = vi.fn()
    render(<AppInactivityModal seconds={5} onContinue={onContinue} onTimeout={onTimeout} />)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
