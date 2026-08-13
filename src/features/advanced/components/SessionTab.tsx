interface Props {
  sessionState: 'checking' | 'opened' | 'closed' | 'error'
  sessionId: number | null
  cashierName: string
  openingDate: string | null
  stationName: string
  onRequestOpenSession: () => void
  onRequestCloseSession: () => void
  onRequestPrintReport: (tipo: 'X' | 'Z', reportName: string) => void
  onRequestCierreTurno: () => void
  onRequestPreCierreMerchant: () => void
  onRequestCierreMerchant: () => void
  preMerchantPrinted: boolean
}

const BADGE_BASE = 'text-[0.9rem] font-extrabold px-[0.85rem] py-[0.35rem] rounded-full'
const BADGE_OPEN = `${BADGE_BASE} bg-[rgba(16,185,129,0.1)] text-[#10b981]`
const BADGE_CLOSED = `${BADGE_BASE} bg-[rgba(239,68,68,0.1)] text-[#ef4444]`
const CIERRE_CARD =
  'border border-surface-border p-[1.5rem_1rem] rounded-app flex flex-col items-center gap-3 cursor-pointer transition-all duration-[0.4s] ease-[cubic-bezier(0.2,0.8,0.2,1)] no-underline font-app bg-panel shadow-app group hover:-translate-y-[10px] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] hover:border-accent active:scale-[0.96] active:-translate-y-[5px]'

export function SessionTab({
  sessionState,
  sessionId,
  cashierName,
  openingDate,
  stationName,
  onRequestOpenSession,
  onRequestCloseSession,
  onRequestPrintReport,
  onRequestCierreTurno,
  onRequestPreCierreMerchant,
  onRequestCierreMerchant,
  preMerchantPrinted
}: Props) {
  return (
    <div className="flex flex-col w-full">
      <div className="bg-panel border border-surface-border rounded-app p-10 shadow-app flex flex-col gap-6 text-left max-w-[600px] mx-auto mb-10">
        <div className="flex justify-between items-center border-b-2 border-surface pb-4 gap-4">
          <h3>Estado de la Sesión</h3>
          <span className={sessionState === 'opened' ? BADGE_OPEN : BADGE_CLOSED}>
            {sessionState === 'opened' ? '🟢 ACTIVA' : sessionState === 'checking' ? '🟡 VERIFICANDO...' : '🔴 CERRADA'}
          </span>
        </div>

        <div className="flex flex-col gap-3 text-[1.1rem] [&>p]:text-text [&>p>strong]:text-text-muted [&>p>strong]:font-semibold [&>p>strong]:mr-2">
          <p><strong>Estación:</strong> {stationName || 'No configurada'}</p>
          {sessionState === 'opened' && (
            <>
              <p><strong>Cajero Activo:</strong> {cashierName}</p>
              <p><strong>Fecha de Apertura:</strong> {openingDate ? new Date(openingDate).toLocaleString() : 'N/A'}</p>
              <p><strong>ID de Sesión:</strong> {sessionId}</p>
            </>
          )}
        </div>

        <div className="flex gap-4 mt-2 [&>button]:flex-1">
          {sessionState === 'closed' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRequestOpenSession}
            >
              Aperturar Caja
            </button>
          )}
          {sessionState === 'opened' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRequestCloseSession}
            >
              Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {sessionState === 'opened' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
          <button
            type="button"
            className={CIERRE_CARD}
            onClick={onRequestPreCierreMerchant}
          >
            <div className="text-[2.2rem] flex items-center justify-center w-[60px] h-[60px] rounded-full bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:bg-accent-subtle group-hover:scale-110">🧾</div>
            <div className="text-[1.2rem] font-extrabold text-text">Pre cierre Merchant</div>
            <div className="text-[0.85rem] text-text-muted leading-[1.5] text-center">Corte previo del lote del terminal de pago</div>
          </button>

          <button
            type="button"
            className={`${CIERRE_CARD} ${!preMerchantPrinted ? 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-app hover:border-surface-border' : ''}`}
            disabled={!preMerchantPrinted}
            onClick={onRequestCierreMerchant}
          >
            <div className="text-[2.2rem] flex items-center justify-center w-[60px] h-[60px] rounded-full bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:bg-accent-subtle group-hover:scale-110">🧾</div>
            <div className="text-[1.2rem] font-extrabold text-text">Cierre Merchant</div>
            <div className="text-[0.85rem] text-text-muted leading-[1.5] text-center">Cierre de lote del terminal de pago (requiere pre cierre)</div>
          </button>

          <button
            type="button"
            className={CIERRE_CARD}
            onClick={onRequestCierreTurno}
          >
            <div className="text-[2.2rem] flex items-center justify-center w-[60px] h-[60px] rounded-full bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:bg-accent-subtle group-hover:scale-110">⏱</div>
            <div className="text-[1.2rem] font-extrabold text-text">Cierre de Turno</div>
            <div className="text-[0.85rem] text-text-muted leading-[1.5] text-center">Imprime ticket de totales y cierra la sesión de caja</div>
          </button>

          <button
            type="button"
            className={CIERRE_CARD}
            onClick={() => onRequestPrintReport('X', 'Cierre de Caja')}
          >
            <div className="text-[2.2rem] flex items-center justify-center w-[60px] h-[60px] rounded-full bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:bg-accent-subtle group-hover:scale-110">💵</div>
            <div className="text-[1.2rem] font-extrabold text-text">Cierre de Caja</div>
            <div className="text-[0.85rem] text-text-muted leading-[1.5] text-center">Lectura de acumulados de caja - Reporte X</div>
          </button>

          <button
            type="button"
            className={CIERRE_CARD}
            onClick={() => onRequestPrintReport('Z', 'Cierre de Reporte Z')}
          >
            <div className="text-[2.2rem] flex items-center justify-center w-[60px] h-[60px] rounded-full bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:bg-accent-subtle group-hover:scale-110">📊</div>
            <div className="text-[1.2rem] font-extrabold text-text">Cierre de Reporte Z</div>
            <div className="text-[0.85rem] text-text-muted leading-[1.5] text-center">Cierre fiscal obligatorio del día - Reporte Z</div>
          </button>
        </div>
      )}
    </div>
  )
}
