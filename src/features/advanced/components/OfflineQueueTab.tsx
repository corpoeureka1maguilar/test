import type { QueueEntry } from '@/shared/lib/orderQueue'
import styles from '../pages/AdvancedMenu.module.css'

interface Props {
  queueEntries: QueueEntry[]
  onRequeue: (entry: QueueEntry) => void
  onDiscard: (entry: QueueEntry) => void
}

export function OfflineQueueTab({ queueEntries, onRequeue, onDiscard }: Props) {
  return (
    <div className={`${styles.sectionCard} ${styles.queueSectionCard}`}>
      <h3 className={styles.sectionTitle}>Cola de Ventas Offline</h3>
      <div className={`${styles.listContainer} ${styles.queueListContainer}`}>
        {queueEntries.length === 0 ? (
          <p className={styles.emptyState}>No hay ventas pendientes de sincronización</p>
        ) : (
          queueEntries.map((entry) => (
            <div key={entry.id} className={styles.queueItem}>
              <div className={styles.queueInfo}>
                <div className={styles.viewMeta}>
                  <span className={styles.itemName}>{entry.id}</span>
                  <span className={`${styles.badge} ${entry.status === 'failed' ? styles.badgeClosed : styles.badgeOpen}`}>
                    {entry.status === 'failed' ? 'FALLIDA' : entry.status === 'draining' ? 'SINCRONIZANDO' : 'PENDIENTE'}
                  </span>
                </div>
                <span className={`${styles.info} ${styles.queueMeta}`}>
                  Encolada: {new Date(entry.enqueuedAt).toLocaleString()} · Intentos: {entry.attempts}
                </span>
                {entry.lastError && (
                  <span className={`${styles.info} ${styles.queueError}`}>
                    Último error: {entry.lastError}
                  </span>
                )}
              </div>
              {entry.status === 'failed' && (
                <div className={styles.queueActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => onRequeue(entry)}>
                    Reintentar
                  </button>
                  <button type="button" className={styles.resetBtn} onClick={() => onDiscard(entry)}>
                    Descartar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
