import { useState, useEffect } from 'react'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { getMetrics, resetMetrics } from '@/shared/lib/metrics'
import type { AdvancedTab } from '../components/AdvancedTabs'
import type { PendingAdminAction } from './useAdminPinAction'

export function useAdvancedMetrics(activeTab: AdvancedTab, requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast } = useUIStore()
  const [metrics, setMetrics] = useState(() => getMetrics())

  useEffect(() => {
    if (activeTab === 'metrics') {
      setMetrics(getMetrics())
    }
  }, [activeTab])

  const handleResetMetrics = () => {
    requestAdminAction({
      title: 'Confirma para restablecer las métricas',
      operationRef: KIOSK_OPERATIONS.terminalConfig,
      run: () => {
        resetMetrics()
        setMetrics(getMetrics())
        pushToast('success', 'Métricas restablecidas')
      }
    })
  }

  return { metrics, handleResetMetrics }
}
