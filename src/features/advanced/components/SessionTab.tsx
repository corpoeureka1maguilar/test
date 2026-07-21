import styles from '../pages/AdvancedMenu.module.css'

interface Props {
  sessionState: 'checking' | 'opened' | 'closed' | 'error'
  sessionId: number | null
  cashierName: string
  openingDate: string | null
  stationName: string
  onRequestOpenSession: () => void
  onRequestCloseSession: () => void
  onRequestPrintReport: (tipo: 'X' | 'Z', reportName: string) => void
}

export function SessionTab({
  sessionState,
  sessionId,
  cashierName,
  openingDate,
  stationName,
  onRequestOpenSession,
  onRequestCloseSession,
  onRequestPrintReport
}: Props) {
  return (
    <div className={styles.cierresContainer}>
      <div className={styles.sessionCard}>
        <div className={styles.sessionHeader}>
          <h3>Estado de la Sesión</h3>
          <span className={`${styles.badge} ${sessionState === 'opened' ? styles.badgeOpen : styles.badgeClosed}`}>
            {sessionState === 'opened' ? '🟢 ACTIVA' : sessionState === 'checking' ? '🟡 VERIFICANDO...' : '🔴 CERRADA'}
          </span>
        </div>

        <div className={styles.sessionDetails}>
          <p><strong>Estación:</strong> {stationName || 'No configurada'}</p>
          {sessionState === 'opened' && (
            <>
              <p><strong>Cajero Activo:</strong> {cashierName}</p>
              <p><strong>Fecha de Apertura:</strong> {openingDate ? new Date(openingDate).toLocaleString() : 'N/A'}</p>
              <p><strong>ID de Sesión:</strong> {sessionId}</p>
            </>
          )}
        </div>

        <div className={styles.sessionActions}>
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
              className="btn btn-danger"
              onClick={onRequestCloseSession}
            >
              Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {sessionState === 'opened' && (
        <div className={styles.cierresGrid}>
          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreTurno}`}
            onClick={() => onRequestPrintReport('X', 'Cierre de Turno')}
          >
            <div className={styles.cierreIcon}>⏱</div>
            <div className={styles.cierreTitle}>Cierre de Turno</div>
            <div className={styles.cierreDesc}>Imprime Reporte X sin cerrar memoria fiscal del día</div>
          </button>

          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreCaja}`}
            onClick={() => onRequestPrintReport('X', 'Cierre de Caja')}
          >
            <div className={styles.cierreIcon}>💵</div>
            <div className={styles.cierreTitle}>Cierre de Caja</div>
            <div className={styles.cierreDesc}>Lectura de acumulados de caja - Reporte X</div>
          </button>

          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreZ}`}
            onClick={() => onRequestPrintReport('Z', 'Cierre de Reporte Z')}
          >
            <div className={styles.cierreIcon}>📊</div>
            <div className={styles.cierreTitle}>Cierre de Reporte Z</div>
            <div className={styles.cierreDesc}>Cierre fiscal obligatorio del día - Reporte Z</div>
          </button>
        </div>
      )}
    </div>
  )
}
