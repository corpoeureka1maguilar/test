import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/shared/lib/odooRepository', () => ({
  fetchProducts: vi.fn()
}))

import { fetchProducts } from '@/shared/lib/odooRepository'
import { useProducts } from './useProducts'

const fetchProductsMock = fetchProducts as ReturnType<typeof vi.fn>

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  fetchProductsMock.mockReset()
  fetchProductsMock.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useProducts', () => {
  it('fetches once on mount', async () => {
    renderHook(() => useProducts(), { wrapper: createWrapper() })
    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1))
  })

  it('polls again after 10 minutes without a manual refetch', async () => {
    vi.useFakeTimers()
    renderHook(() => useProducts(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(fetchProductsMock).toHaveBeenCalledTimes(2)
  })

  it('does not refetch before the 10 minute interval elapses', async () => {
    vi.useFakeTimers()
    renderHook(() => useProducts(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(fetchProductsMock).toHaveBeenCalledTimes(1)
  })
})
