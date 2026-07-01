import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/shared/lib/odooRepository', () => ({
  fetchAdvertisements: vi.fn()
}))

import { fetchAdvertisements } from '@/shared/lib/odooRepository'
import { useAdvertisements } from './useAdvertisements'

const fetchAdvertisementsMock = fetchAdvertisements as ReturnType<typeof vi.fn>

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  fetchAdvertisementsMock.mockReset()
  fetchAdvertisementsMock.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAdvertisements', () => {
  it('fetches once on mount, disabled until enabled=true', async () => {
    renderHook(() => useAdvertisements(true), { wrapper: createWrapper() })
    await waitFor(() => expect(fetchAdvertisementsMock).toHaveBeenCalledTimes(1))
  })

  it('does not fetch when enabled=false', async () => {
    renderHook(() => useAdvertisements(false), { wrapper: createWrapper() })
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchAdvertisementsMock).not.toHaveBeenCalled()
  })

  it('polls again after 10 minutes to pick up schedule/content changes', async () => {
    vi.useFakeTimers()
    renderHook(() => useAdvertisements(true), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(fetchAdvertisementsMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(fetchAdvertisementsMock).toHaveBeenCalledTimes(2)
  })
})
