import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/shared/lib/odooRepository', () => ({
  fetchPaymentMethods: vi.fn()
}))

import { fetchPaymentMethods } from '@/shared/lib/odooRepository'
import { usePaymentMethods } from './usePaymentMethods'
import { DB_NAME, resetOfflineDbForTests } from '@/shared/lib/idbStore'
import { replacePaymentMethods } from '@/shared/lib/offlineCache'
import { useConfigStore } from '@/shared/stores/config'

const fetchPaymentMethodsMock = fetchPaymentMethods as ReturnType<typeof vi.fn>

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

async function deleteOfflineDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  fetchPaymentMethodsMock.mockReset()
  fetchPaymentMethodsMock.mockResolvedValue([])
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => { setTimeout(resolve, 0) })
  }
  resetOfflineDbForTests()
  await deleteOfflineDb()
  useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
})

describe('usePaymentMethods', () => {
  it('fetches once on mount', async () => {
    renderHook(() => usePaymentMethods(), { wrapper: createWrapper() })
    await waitFor(() => expect(fetchPaymentMethodsMock).toHaveBeenCalledTimes(1))
  })

  it('serves cached payment methods when the network fetch rejects and a cache exists', async () => {
    await replacePaymentMethods([{ id: 7, name: 'Efectivo' }])
    fetchPaymentMethodsMock.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 7, name: 'Efectivo' }])
  })

  it('returns an empty list (not an error) when the fetch rejects and nothing was ever cached', async () => {
    fetchPaymentMethodsMock.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
