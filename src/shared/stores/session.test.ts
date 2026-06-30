import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/lib/odooRepository', () => ({
  fetchActiveSession: vi.fn(),
  fetchCashier: vi.fn(),
  openOdooSession: vi.fn(),
  closeOdooSession: vi.fn()
}))
vi.mock('@/shared/lib/odooEnv', () => ({
  odooEnv: { uid: 1 }
}))

import { useSessionStore } from './session'
import { fetchActiveSession, fetchCashier, openOdooSession, closeOdooSession } from '@/shared/lib/odooRepository'

const mFetchActiveSession = fetchActiveSession as ReturnType<typeof vi.fn>
const mFetchCashier = fetchCashier as ReturnType<typeof vi.fn>
const mOpenOdooSession = openOdooSession as ReturnType<typeof vi.fn>
const mCloseOdooSession = closeOdooSession as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  useSessionStore.setState({
    sessionId: null, cashierId: null, cashierName: '', sessionState: 'checking', openingDate: null, errorMsg: null
  })
})

describe('checkSession', () => {
  it('marks the session as closed when the station has no id', async () => {
    await useSessionStore.getState().checkSession(0)
    const state = useSessionStore.getState()
    expect(state.sessionState).toBe('closed')
    expect(state.errorMsg).toBe('Estación no configurada')
    expect(mFetchActiveSession).not.toHaveBeenCalled()
  })

  it('marks the session as opened and resolves the cashier when an active session exists', async () => {
    mFetchActiveSession.mockResolvedValueOnce({ id: 5, openingDate: '2026-06-30' })
    mFetchCashier.mockResolvedValueOnce({ id: 9, name: 'Cajero Kiosco' })

    await useSessionStore.getState().checkSession(1)

    const state = useSessionStore.getState()
    expect(state.sessionState).toBe('opened')
    expect(state.sessionId).toBe(5)
    expect(state.cashierId).toBe(9)
    expect(state.cashierName).toBe('Cajero Kiosco')
  })

  it('marks the session as closed when there is no active session', async () => {
    mFetchActiveSession.mockResolvedValueOnce(null)
    await useSessionStore.getState().checkSession(1)
    const state = useSessionStore.getState()
    expect(state.sessionState).toBe('closed')
    expect(state.sessionId).toBeNull()
  })

  it('marks the session as error when the lookup throws', async () => {
    mFetchActiveSession.mockRejectedValueOnce(new Error('Odoo no disponible'))
    await useSessionStore.getState().checkSession(1)
    const state = useSessionStore.getState()
    expect(state.sessionState).toBe('error')
    expect(state.errorMsg).toBe('Odoo no disponible')
  })
})

describe('openSession', () => {
  it('opens a session and stores the cashier and session id', async () => {
    mFetchCashier.mockResolvedValueOnce({ id: 9, name: 'Cajero Kiosco' })
    mOpenOdooSession.mockResolvedValueOnce(77)

    const sessionId = await useSessionStore.getState().openSession(1)

    expect(sessionId).toBe(77)
    const state = useSessionStore.getState()
    expect(state.sessionState).toBe('opened')
    expect(state.sessionId).toBe(77)
    expect(state.cashierId).toBe(9)
  })

  it('throws and sets sessionState to closed when the user has no cashier', async () => {
    mFetchCashier.mockResolvedValueOnce(null)
    await expect(useSessionStore.getState().openSession(1)).rejects.toThrow(
      'El usuario no tiene un cajero asociado en Odoo para esta sucursal/estación'
    )
    expect(useSessionStore.getState().sessionState).toBe('closed')
  })
})

describe('closeSession', () => {
  it('does nothing when there is no active session id', async () => {
    await useSessionStore.getState().closeSession()
    expect(mCloseOdooSession).not.toHaveBeenCalled()
  })

  it('closes the session and resets session/cashier state', async () => {
    useSessionStore.setState({ sessionId: 5, cashierId: 9, cashierName: 'Cajero Kiosco', sessionState: 'opened' })
    mCloseOdooSession.mockResolvedValueOnce(undefined)

    await useSessionStore.getState().closeSession()

    const state = useSessionStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.sessionState).toBe('closed')
  })

  it('keeps the session marked as opened when closing fails', async () => {
    useSessionStore.setState({ sessionId: 5, sessionState: 'opened' })
    mCloseOdooSession.mockRejectedValueOnce(new Error('Error de red'))

    await expect(useSessionStore.getState().closeSession()).rejects.toThrow('Error de red')
    expect(useSessionStore.getState().sessionState).toBe('opened')
  })
})

describe('reset', () => {
  it('clears all session and cashier state', () => {
    useSessionStore.setState({ sessionId: 5, cashierId: 9, cashierName: 'X', sessionState: 'opened', errorMsg: 'oops' })
    useSessionStore.getState().reset()
    const state = useSessionStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.sessionState).toBe('closed')
    expect(state.errorMsg).toBeNull()
  })
})
