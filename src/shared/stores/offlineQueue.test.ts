import { describe, it, expect, beforeEach } from 'vitest'
import { useOfflineQueueStore } from './offlineQueue'

beforeEach(() => {
  useOfflineQueueStore.setState({ count: 0 })
})

describe('offlineQueueStore', () => {
  it('has initial count of 0', () => {
    expect(useOfflineQueueStore.getState().count).toBe(0)
  })

  it('updates count using setCount', () => {
    useOfflineQueueStore.getState().setCount(5)
    expect(useOfflineQueueStore.getState().count).toBe(5)
  })
})
