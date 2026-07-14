import { useState, useEffect } from 'react'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { peekAll, requeueFailed, dequeue, matchesInstance, type QueueEntry } from '@/shared/lib/orderQueue'
import { getInstanceKey } from '@/shared/lib/idbStore'
import { drain } from '@/shared/lib/syncManager'
import type { AdvancedTab } from '../components/AdvancedTabs'
import type { PendingAdminAction } from './useAdminPinAction'

export function useOfflineQueue(activeTab: AdvancedTab, requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast, setLoading } = useUIStore()
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])

  // Solo se muestran/tocan entradas de LA instancia actual (design ADR-6):
  // una entrada de otra instancia queda dormida y no debe exponerse acá.
  const loadQueue = async () => {
    const instanceKey = getInstanceKey()
    const all = await peekAll()
    setQueueEntries(all.filter((e) => matchesInstance(e, instanceKey)))
  }

  useEffect(() => {
    if (activeTab === 'cola') loadQueue()
  }, [activeTab])

  const requestRequeue = (entry: QueueEntry) => {
    requestAdminAction({
      title: `Confirma para reintentar la venta ${entry.id}`,
      operationRef: KIOSK_OPERATIONS.terminalConfig,
      auditMessage: `Reintento manual de sincronización offline (venta ${entry.id})`,
      run: () => handleRequeue(entry.id)
    })
  }

  const handleRequeue = async (id: string) => {
    setLoading(true)
    try {
      await requeueFailed(id)
      await drain()
      await loadQueue()
      pushToast('success', 'Venta reencolada; sincronizando con Odoo...')
    } catch (err) {
      pushToast('error', `Error al reencolar: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const requestDiscard = (entry: QueueEntry) => {
    requestAdminAction({
      title: `Confirma para DESCARTAR definitivamente la venta ${entry.id}`,
      operationRef: KIOSK_OPERATIONS.terminalConfig,
      auditMessage: `Descarte manual de venta offline fallida (venta ${entry.id})`,
      run: () => handleDiscard(entry.id)
    })
  }

  const handleDiscard = async (id: string) => {
    setLoading(true)
    try {
      await dequeue(id)
      await loadQueue()
      pushToast('success', 'Venta descartada de la cola offline')
    } catch (err) {
      pushToast('error', `Error al descartar: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return { queueEntries, requestRequeue, requestDiscard }
}
