import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import type { PendingAdminAction } from './useAdminPinAction'

export function useSessionControls(requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast, setLoading } = useUIStore()
  const stationId = useConfigStore((s) => s.stationId)
  const stationName = useConfigStore((s) => s.stationName)

  const sessionState = useSessionStore((s) => s.sessionState)
  const sessionId = useSessionStore((s) => s.sessionId)
  const cashierName = useSessionStore((s) => s.cashierName)
  const openingDate = useSessionStore((s) => s.openingDate)
  const openSession = useSessionStore((s) => s.openSession)
  const closeSession = useSessionStore((s) => s.closeSession)

  const handleOpenSession = async () => {
    if (!stationId) {
      pushToast('error', 'La estación no está configurada. Configurala en la pestaña Terminal.')
      return
    }
    setLoading(true)
    try {
      await openSession(stationId)
      pushToast('success', 'Sesión de caja aperturada con éxito en Odoo')
    } catch (err) {
      pushToast('error', `Error al abrir sesión: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseSession = async () => {
    setLoading(true)
    try {
      await closeSession()
      pushToast('success', 'Sesión de caja cerrada con éxito en Odoo')
    } catch (err) {
      pushToast('error', `Error al cerrar sesión: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const requestOpenSession = () => {
    requestAdminAction({
      title: 'Confirma para aperturar caja',
      operationRef: KIOSK_OPERATIONS.openSession,
      run: handleOpenSession
    })
  }

  const requestCloseSession = () => {
    requestAdminAction({
      title: 'Confirma para cerrar caja',
      operationRef: KIOSK_OPERATIONS.sessionClose,
      run: handleCloseSession
    })
  }

  return {
    sessionState,
    sessionId,
    cashierName,
    openingDate,
    stationName,
    requestOpenSession,
    requestCloseSession
  }
}
