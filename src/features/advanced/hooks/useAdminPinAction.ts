import { useState } from 'react'
import type { KioskOperationRef } from '@/shared/lib/odooRepository'

// Toda acción administrativa pasa por el PIN modal con su operación de
// auditoría: la validación (y el permiso por cajero) la resuelve Odoo
export interface PendingAdminAction {
  title: string
  operationRef: KioskOperationRef
  auditMessage?: string | undefined
  run: () => void
}

export function useAdminPinAction() {
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null)

  const confirmPendingAction = () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    action.run()
  }

  const cancelPendingAction = () => setPendingAction(null)

  return {
    pendingAction,
    requestAdminAction: setPendingAction,
    confirmPendingAction,
    cancelPendingAction
  }
}
