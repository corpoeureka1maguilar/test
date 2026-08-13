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
  const {
    reason,
    setReason,
    done,
    requestReturn,
    selection,
    toggleLine,
    setQty,
    selectAll,
    clearAll,
    isValid: isReturnValid
  } = useOrderReturn(search.order, requestAdminAction)
  const { requestReprint } = useOrderReprint(search.order, requestAdminAction)
  const { requestPrintReport, requestCierreTurno } = useFiscalReports(requestAdminAction)

  if (done) {
    return (
      <div className="kiosk-container items-center justify-center text-center gap-10">
        <div className="w-[100px] h-[100px] bg-accent-subtle text-accent rounded-full flex items-center justify-center text-[4rem] mx-auto animate-scaleIn">✓</div>
        <h2>Devolución procesada</h2>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="kiosk-container">
      <h2 className="text-[length:var(--font-h2)] font-extrabold mb-4 text-text">Menú Avanzado</h2>

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
          selection={selection}
          onToggleLine={toggleLine}
          onQtyChange={setQty}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          isValid={isReturnValid}
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
          onRequestCierreTurno={requestCierreTurno}
        />
      )}

      {activeTab === 'terminal' && (
        <TerminalTab
          form={terminal.form}
          isTerminalUnlocked={terminal.isTerminalUnlocked}
          onFieldChange={terminal.setFormField}
          onSubmit={(e) => {
            void terminal.handleSaveConfig(e)
          }}
          onRequestUnlock={terminal.requestUnlockTerminal}
          onReloadCache={() => {
            void terminal.handleReloadCache()
          }}
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

      <button type="button" className="btn btn-secondary mt-auto" onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </div>
  )
}
