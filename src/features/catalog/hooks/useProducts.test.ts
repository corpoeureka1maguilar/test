import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/shared/lib/odooRepository', () => ({
  fetchProducts: vi.fn()
}))

import { fetchProducts } from '@/shared/lib/odooRepository'
import { useProducts } from './useProducts'
import { DB_NAME, resetOfflineDbForTests } from '@/shared/lib/idbStore'
import { replaceProducts } from '@/shared/lib/offlineCache'
import { useConfigStore } from '@/shared/stores/config'

const fetchProductsMock = fetchProducts as ReturnType<typeof vi.fn>

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

async function deleteOfflineDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  fetchProductsMock.mockReset()
  fetchProductsMock.mockResolvedValue([])
  // Deja asentar cualquier write-through fire-and-forget del test anterior
  // (agendado con setImmediate real, puede tomar más de un tick) antes de
  // cerrar/borrar la DB offline — si no, esa escritura tardía puede pisar el
  // reset y dejar datos filtrados (o colgar) en el siguiente test
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  resetOfflineDbForTests()
  await deleteOfflineDb()
  useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
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
    // No fakear setImmediate: fake-indexeddb lo usa internamente para resolver
    // sus requests, y fakearlo dejaría colgado el write-through al caché offline
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    renderHook(() => useProducts(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(fetchProductsMock).toHaveBeenCalledTimes(2)
  })

  it('does not refetch before the 10 minute interval elapses', async () => {
    // No fakear setImmediate: fake-indexeddb lo usa internamente para resolver
    // sus requests, y fakearlo dejaría colgado el write-through al caché offline
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    renderHook(() => useProducts(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(fetchProductsMock).toHaveBeenCalledTimes(1)
  })

  it('serves the cached products when the network fetch rejects and a cache exists', async () => {
    await replaceProducts([{ id: 1, name: 'Cached product' }])
    fetchProductsMock.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 1, name: 'Cached product' }])
  })

  it('throws when the network fetch rejects and nothing was ever cached', async () => {
    fetchProductsMock.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
