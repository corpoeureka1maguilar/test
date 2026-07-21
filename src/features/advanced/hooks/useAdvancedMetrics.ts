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
    // getMetrics() lee un store externo (no React) que otras pestañas/vistas
    // pueden haber mutado mientras tanto; hay que releerlo al reabrir la
    // pestaña, no es un valor derivable de props/estado local.
    if (activeTab === 'metrics') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
