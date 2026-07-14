import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { AdvancedTabs, type AdvancedTab } from '../components/AdvancedTabs'
import { ReturnsTab } from '../components/ReturnsTab'
import { ReprintTab } from '../components/ReprintTab'
import { SessionTab } from '../components/SessionTab'
import { TerminalTab } from '../components/TerminalTab'
import { MetricsTab } from '../components/MetricsTab'
import { OfflineQueueTab } from '../components/OfflineQueueTab'
import { useAdminPinAction } from '../hooks/useAdminPinAction'
import { useExchangeRateSync } from '../hooks/useExchangeRateSync'
import { useSessionControls } from '../hooks/useSessionControls'
import { useAdvancedMetrics } from '../hooks/useAdvancedMetrics'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useTerminalConfig } from '../hooks/useTerminalConfig'
import { useOrderSearch } from '../hooks/useOrderSearch'
import { useOrderReturn } from '../hooks/useOrderReturn'
import { useOrderReprint } from '../hooks/useOrderReprint'
import { useFiscalReports } from '../hooks/useFiscalReports'
import styles from './AdvancedMenu.module.css'

export function AdvancedMenu() {
  const navigate = useNavigate()
  const location = useLocation()

  const locationState = location.state as { defaultTab?: AdvancedTab } | null
  const defaultTab = locationState?.defaultTab || 'devoluciones'
  const [activeTab, setActiveTab] = useState<AdvancedTab>(defaultTab)

  const { pendingAction, requestAdminAction, confirmPendingAction, cancelPendingAction } = useAdminPinAction()
  const rate = useExchangeRateSync()
  const session = useSessionControls(requestAdminAction)
  const { metrics, handleResetMetrics } = useAdvancedMetrics(activeTab, requestAdminAction)
  const { queueEntries, requestRequeue, requestDiscard } = useOfflineQueue(activeTab, requestAdminAction)
  const terminal = useTerminalConfig(activeTab, requestAdminAction)
  const search = useOrderSearch()
  const { reason, setReason, done, requestReturn } = useOrderReturn(search.order, requestAdminAction)
  const { requestReprint } = useOrderReprint(search.order, requestAdminAction)
  const { requestPrintReport } = useFiscalReports(requestAdminAction)

  if (done) {
    return (
      <div className={`kiosk-container ${styles.center}`}>
        <div className={styles.iconSuccess}>✓</div>
        <h2>Devolución procesada</h2>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Menú Avanzado</h2>

      <AdvancedTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {activeTab === 'devoluciones' && (
        <ReturnsTab
          selectedOrder={search.selectedOrder}
          order={search.order}
          pattern={search.pattern}
          onPatternChange={search.setPattern}
          isFetching={search.isFetching}
          results={search.results}
          rate={rate}
          onSelectOrder={search.setSelectedOrder}
          onClearSelection={() => search.setSelectedOrder(null)}
          reason={reason}
          onReasonChange={setReason}
          onRequestReturn={requestReturn}
        />
      )}

      {activeTab === 'reimpresion' && (
        <ReprintTab
          selectedOrder={search.selectedOrder}
          order={search.order}
          pattern={search.pattern}
          onPatternChange={search.setPattern}
          isFetching={search.isFetching}
          results={search.results}
          rate={rate}
          onSelectOrder={search.setSelectedOrder}
          onClearSelection={() => search.setSelectedOrder(null)}
          onRequestReprint={requestReprint}
        />
      )}

      {activeTab === 'cierres' && (
        <SessionTab
          sessionState={session.sessionState}
          sessionId={session.sessionId}
          cashierName={session.cashierName}
          openingDate={session.openingDate}
          stationName={session.stationName}
          onRequestOpenSession={session.requestOpenSession}
          onRequestCloseSession={session.requestCloseSession}
          onRequestPrintReport={requestPrintReport}
        />
      )}

      {activeTab === 'terminal' && (
        <TerminalTab
          form={terminal.form}
          isTerminalUnlocked={terminal.isTerminalUnlocked}
          onFieldChange={terminal.setFormField}
          onSubmit={terminal.handleSaveConfig}
          onRequestUnlock={terminal.requestUnlockTerminal}
          onReloadCache={terminal.handleReloadCache}
        />
      )}

      {activeTab === 'metrics' && (
        <MetricsTab metrics={metrics} rate={rate} onResetMetrics={handleResetMetrics} />
      )}

      {activeTab === 'cola' && (
        <OfflineQueueTab
          queueEntries={queueEntries}
          onRequeue={requestRequeue}
          onDiscard={requestDiscard}
        />
      )}

      {pendingAction && (
        <AppPinModal
          title={pendingAction.title}
          operationRef={pendingAction.operationRef}
          auditMessage={pendingAction.auditMessage}
          onConfirmed={confirmPendingAction}
          onCancel={cancelPendingAction}
        />
      )}

      <button type="button" className="btn" style={{ marginTop: 'auto' }} onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </div>
  )
}
