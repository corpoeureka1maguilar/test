// Synchronizer del kiosko (offline-sync) — detecta la reconexión con Odoo y
// drena la cola offline (orderQueue) de forma secuencial e idempotente. Ver
// design.md ADR-3: nunca corre en paralelo, un solo drain() a la vez.

import { peekAll, markStatus, markFailed, dequeue, resetDrainingToPending, tagLegacyEntries, matchesInstance } from './orderQueue'
import { createSaleOrder, setOrderPrinterData, pingStation } from './odooRepository'
import { OdooServerError, isAccessDeniedError } from './odooEnv'
import { useConfigStore } from '@/shared/stores/config'
import { getInstanceKey } from './idbStore'

export const BACKOFF_BASE_MS = 5_000
export const BACKOFF_FACTOR = 2
export const BACKOFF_CAP_MS = 60_000

let initialized = false
let draining = false
let pollTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
let unsubscribeConfig: (() => void) | null = null

function clearPoll(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

// Backoff exponencial con full jitter (base 5s, factor 2, tope 60s). Se
// reinicia (attempt=0) en cada paso de drain exitoso o cuando la cola queda
// vacía; solo corre mientras haya algo pendiente por drenar.
function scheduleBackoffPoll(): void {
  clearPoll()
  const cap = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt)
  const delay = Math.random() * cap
  attempt++
  pollTimer = setTimeout(() => {
    pollTimer = null
    void pollAndDrain()
  }, delay)
}

// El poll propio existe porque un kiosko idle y offline no genera tráfico
// espontáneo que dispare la suscripción a isOffline (ver design ADR-3,
// rechazado: "confiar solo en una señal oportunista"). pingStation es solo un
// intento de reconexión — si falla, drain() de todas formas vuelve a fallar
// transitoriamente y se reprograma el próximo backoff.
async function pollAndDrain(): Promise<void> {
  const stationId = useConfigStore.getState().stationId
  if (stationId) {
    try {
      await pingStation(stationId)
      useConfigStore.setState({ isOffline: false, isConnectionReady: true })
    } catch {
      // Seguimos sin conexión: drain() abajo va a volver a fallar transitoriamente
      // y reprogramar el próximo intento con backoff creciente.
    }
  }
  await drain()
}

// Drena la cola FIFO (por 'seq', vía peekAll) de a un item a la vez. Los items
// 'failed' (rechazo permanente de Odoo) se saltan pero NO se eliminan — quedan
// para revisión manual (ver design Failure Modes: ya se imprimió un
// comprobante fiscal, no se puede borrar la evidencia).
export async function drain(): Promise<void> {
  if (draining) return
  // Instance scoping (design ADR-6): un kiosko sin instancia configurada
  // nunca drena nada; una entrada de OTRA instancia nunca se toca (ni se
  // envía, ni se marca failed, ni se borra — queda dormida).
  const instanceKey = getInstanceKey()
  if (instanceKey == null) return
  draining = true
  try {
    for (;;) {
      const all = await peekAll()
      const target = all.find((e) => e.status !== 'failed' && matchesInstance(e, instanceKey))
      if (!target) {
        clearPoll()
        attempt = 0
        return
      }

      await markStatus(target.id, 'draining')

      let odooOrderId: number | undefined
      try {
        // Reenvío EXACTO del payload guardado — nunca se reconstruye (ver
        // ADR-1/ADR-2 del design: reconstruir podría driftear tasa/líneas y
        // romper la deduplicación por x_fex_id en el backend)
        const result = (await createSaleOrder(target.payload)) as { id?: number } | null | undefined
        odooOrderId = result?.id
      } catch (err) {
        if (err instanceof OdooServerError && !isAccessDeniedError(err)) {
          // Permanente: se marca 'failed' (se conserva) y se SALTA al
          // siguiente item — un rechazo de negocio no debe wedgear la cola
          await markFailed(target.id, err.message)
          continue
        }
        // Transitorio (red, o AccessDenied por sesión aún no restablecida
        // tras un refresh): se revierte a 'pending' y se DETIENE el drain —
        // el resto de la cola espera al próximo intento (backoff o reconexión)
        await markStatus(target.id, 'pending')
        scheduleBackoffPoll()
        return
      }

      if (target.fiscal && odooOrderId != null) {
        await setOrderPrinterData(odooOrderId, target.fiscal.code, target.fiscal.date, target.fiscal.serial).catch((err) => {
          console.error('[syncManager] Error registrando dato fiscal post-drain:', err)
        })
      }

      await dequeue(target.id)
      attempt = 0
    }
  } finally {
    draining = false
  }
}

// Arranque: recupera items que quedaron 'draining' a mitad de un drain
// interrumpido (spec: App Restart Mid-Drain Recovery) y se suscribe a la
// transición isOffline true->false para drenar automáticamente al reconectar.
export async function initSyncManager(): Promise<void> {
  if (initialized) return
  initialized = true

  // Orden importa (design ADR-6): taguear legacy ANTES de resetear
  // 'draining', para que el reset ya pueda filtrar correctamente por
  // instancia.
  await tagLegacyEntries()
  await resetDrainingToPending()

  unsubscribeConfig = useConfigStore.subscribe((state, prevState) => {
    if (prevState.isOffline && !state.isOffline) {
      void drain()
    }
  })

  const instanceKey = getInstanceKey()
  if (instanceKey != null) {
    const all = await peekAll()
    if (all.some((e) => e.status !== 'failed' && matchesInstance(e, instanceKey))) {
      void drain()
    }
  }
}

// Solo para tests: revierte el singleton para que cada test arranque limpio
export function resetSyncManagerForTests(): void {
  initialized = false
  draining = false
  attempt = 0
  clearPoll()
  unsubscribeConfig?.()
  unsubscribeConfig = null
}
