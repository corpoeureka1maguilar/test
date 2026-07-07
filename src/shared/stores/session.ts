import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { fetchActiveSession, openOdooSession, closeOdooSession, fetchCashier } from '@/shared/lib/odooRepository'
import { odooEnv } from '@/shared/lib/odooEnv'

interface SessionState {
  sessionId: number | null
  cashierId: number | null
  cashierName: string
  sessionState: 'checking' | 'opened' | 'closed' | 'error'
  openingDate: string | null
  errorMsg: string | null
}

interface SessionActions {
  checkSession(stationId: number): Promise<void>
  openSession(stationId: number): Promise<number>
  closeSession(): Promise<void>
  reset(): void
}

export const useSessionStore = create<SessionState & SessionActions>()(devtools((set, get) => ({
  sessionId: null,
  cashierId: null,
  cashierName: '',
  sessionState: 'checking',
  openingDate: null,
  errorMsg: null,

  async checkSession(stationId) {
    if (!stationId) {
      set({ sessionState: 'closed', sessionId: null, errorMsg: 'Estación no configurada' })
      return
    }
    set({ sessionState: 'checking', errorMsg: null })
    try {
      const session = await fetchActiveSession(stationId)
      if (session) {
        // Obtener cajero
        const uid = odooEnv.uid
        const cashier = await fetchCashier(uid, stationId)
        set({
          sessionId: session.id,
          sessionState: 'opened',
          openingDate: session.openingDate,
          cashierId: cashier?.id || null,
          cashierName: cashier?.name || 'Cajero Kiosco'
        })
      } else {
        set({
          sessionId: null,
          sessionState: 'closed',
          openingDate: null,
          cashierId: null,
          cashierName: ''
        })
      }
    } catch (err) {
      console.error('[SessionStore] Error checking session:', err)
      set({
        sessionState: 'error',
        errorMsg: err instanceof Error ? err.message : 'Error al consultar sesión en Odoo'
      })
    }
  },

  async openSession(stationId) {
    set({ sessionState: 'checking', errorMsg: null })
    try {
      const uid = odooEnv.uid
      if (!uid) {
        throw new Error('Usuario no autenticado en Odoo')
      }
      const cashier = await fetchCashier(uid, stationId)
      if (!cashier) {
        throw new Error('El usuario no tiene un cajero asociado en Odoo para esta sucursal/estación')
      }

      const sessionId = await openOdooSession(stationId, cashier.id)
      set({
        sessionId,
        cashierId: cashier.id,
        cashierName: cashier.name,
        sessionState: 'opened',
        openingDate: new Date().toISOString()
      })
      return sessionId
    } catch (err) {
      console.error('[SessionStore] Error opening session:', err)
      const msg = err instanceof Error ? err.message : 'Error al abrir sesión en Odoo'
      set({ sessionState: 'closed', errorMsg: msg })
      throw new Error(msg)
    }
  },

  async closeSession() {
    const { sessionId } = get()
    if (!sessionId) return

    set({ sessionState: 'checking', errorMsg: null })
    try {
      await closeOdooSession(sessionId)
      set({
        sessionId: null,
        cashierId: null,
        cashierName: '',
        sessionState: 'closed',
        openingDate: null
      })
    } catch (err) {
      console.error('[SessionStore] Error closing session:', err)
      const msg = err instanceof Error ? err.message : 'Error al cerrar sesión en Odoo'
      set({ sessionState: 'opened', errorMsg: msg }) // Mantener abierta si falló
      throw new Error(msg)
    }
  },

  reset() {
    set({
      sessionId: null,
      cashierId: null,
      cashierName: '',
      sessionState: 'closed',
      openingDate: null,
      errorMsg: null
    })
  }
}), { name: 'session' }))
