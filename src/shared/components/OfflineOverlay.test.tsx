import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineOverlay } from './OfflineOverlay'
import { useConfigStore } from '@/shared/stores/config'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { MAX_QUEUE_SIZE } from '@/shared/lib/orderQueue'

beforeEach(() => {
  useConfigStore.setState({ isConfigured: false, isOffline: false })
  useOfflineQueueStore.setState({ count: 0 })
})

describe('OfflineOverlay — guarded by useShouldBlockUI (design ADR-4)', () => {
  it('stays hidden while offline but the queue still has room', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: true })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE - 1 })

    const { container } = render(<OfflineOverlay />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the "queue full" overlay once offline AND the queue reaches capacity', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: true })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE })

    render(<OfflineOverlay />)
    expect(screen.getByText(/cola de ventas offline llena/i)).toBeInTheDocument()
  })

  it('stays hidden when online even if the queue is full', () => {
    useConfigStore.setState({ isConfigured: true, isOffline: false })
    useOfflineQueueStore.setState({ count: MAX_QUEUE_SIZE })

    const { container } = render(<OfflineOverlay />)
    expect(container).toBeEmptyDOMElement()
  })
})
