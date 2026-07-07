import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useShouldBlockUI } from './useShouldBlockUI'
import { useConfigStore } from '@/shared/stores/config'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { MAX_QUEUE_SIZE } from '@/shared/lib/orderQueue'

beforeEach(() => {
  useConfigStore.setState({ isConfigured: false, isOffline: false })
  useOfflineQueueStore.setState({ count: 0 })
})

describe('useShouldBlockUI — derived block selector (design ADR-4)', () => {
  it('returns true when configured, offline, AND the queue is full', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: true })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE })

    const { result } = renderHook(() => useShouldBlockUI())
    expect(result.current).toBe(true)
  })

  it('returns false when offline but the queue still has room', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: true })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE - 1 })

    const { result } = renderHook(() => useShouldBlockUI())
    expect(result.current).toBe(false)
  })

  it('returns false when online even if the queue is full', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: false })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE })

    const { result } = renderHook(() => useShouldBlockUI())
    expect(result.current).toBe(false)
  })

  it('returns false when the kiosk is not configured, regardless of offline/queue state', () => {
    useConfigStore.setState({ isConfigured: false, isOffline: true })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE })

    const { result } = renderHook(() => useShouldBlockUI())
    expect(result.current).toBe(false)
  })
})
