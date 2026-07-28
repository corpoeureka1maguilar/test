import type { QueueEntry } from '@/shared/lib/orderQueue'

interface Props {
  queueEntries: QueueEntry[]
  onRequeue: (entry: QueueEntry) => void
  onDiscard: (entry: QueueEntry) => void
}

const BADGE_BASE = 'text-[0.9rem] font-extrabold px-[0.85rem] py-[0.35rem] rounded-full'
const BADGE_OPEN = `${BADGE_BASE} bg-[rgba(16,185,129,0.1)] text-[#10b981]`
const BADGE_CLOSED = `${BADGE_BASE} bg-[rgba(239,68,68,0.1)] text-[#ef4444]`

export function OfflineQueueTab({ queueEntries, onRequeue, onDiscard }: Props) {
  return (
    <div className="bg-panel border border-surface-border rounded-[24px] p-8 text-left shadow-app flex flex-col gap-6 w-full max-w-[900px]">
      <h3 className="text-[1.25rem] font-extrabold text-text mb-2 border-b-2 border-surface pb-3">Cola de Ventas Offline</h3>
      <div className="flex flex-col gap-3 max-h-none overflow-y-auto">
        {queueEntries.length === 0 ? (
          <p className="text-text-muted text-center py-12 px-4 text-[1.05rem]">No hay ventas pendientes de sincronización</p>
        ) : (
          queueEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-6 px-5 py-4 bg-surface rounded-[14px]">
              <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                <div className="flex justify-between items-center text-[0.95rem]">
                  <span className="font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%]">{entry.id}</span>
                  <span className={entry.status === 'failed' ? BADGE_CLOSED : BADGE_OPEN}>
                    {entry.status === 'failed' ? 'FALLIDA' : entry.status === 'draining' ? 'SINCRONIZANDO' : 'PENDIENTE'}
                  </span>
                </div>
                <span className="text-text-muted p-0 text-[1.2rem]">
                  Encolada: {new Date(entry.enqueuedAt).toLocaleString()} · Intentos: {entry.attempts}
                </span>
                {entry.lastError && (
                  <span className="text-danger p-0 text-[1.2rem]">
                    Último error: {entry.lastError}
                  </span>
                )}
              </div>
              {entry.status === 'failed' && (
                <div className="flex gap-3 flex-shrink-0">
                  <button type="button" className="btn btn-secondary" onClick={() => onRequeue(entry)}>
                    Reintentar
                  </button>
                  <button
                    type="button"
                    className="bg-[rgba(239,68,110,0.1)] text-danger border border-[rgba(239,68,110,0.2)] rounded-xl px-6 py-3 font-app font-bold text-[0.95rem] cursor-pointer transition-all duration-[0.25s] hover:bg-danger hover:text-white hover:border-danger"
                    onClick={() => onDiscard(entry)}
                  >
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
