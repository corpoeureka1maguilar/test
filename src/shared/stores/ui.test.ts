import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './ui'

beforeEach(() => {
  useUIStore.setState({ loading: false, toasts: [] })
})

describe('uiStore', () => {
  it('updates loading state via setLoading', () => {
    expect(useUIStore.getState().loading).toBe(false)
    useUIStore.getState().setLoading(true)
    expect(useUIStore.getState().loading).toBe(true)
  })

  it('pushes a toast to state', () => {
    useUIStore.getState().pushToast('error', 'Error test')
    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe('Error test')
    expect(toasts[0]!.type).toBe('error')
    expect(toasts[0]!.sticky).toBe(false)
  })

  it('dismisses a toast by id', () => {
    useUIStore.getState().pushToast('info', 'Mensaje 1')
    const toastId = useUIStore.getState().toasts[0]!.id

    useUIStore.getState().dismissToast(toastId)
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('clears all toasts', () => {
    useUIStore.getState().pushToast('info', 'Mensaje 1')
    useUIStore.getState().pushToast('success', 'Mensaje 2')
    expect(useUIStore.getState().toasts).toHaveLength(2)

    useUIStore.getState().clearToasts()
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })
})
