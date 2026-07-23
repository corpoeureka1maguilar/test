// Cola FIFO acotada (offline-order-queue) — persiste ventas que no pudieron
// crearse en Odoo por estar offline, para que el synchronizer las drene al
// reconectar. IndexedDB es la fuente de verdad; `offlineQueueStore` es solo
// un espejo síncrono del conteo (ver design ADR: boundary rule).

import { ORDER_QUEUE_STORE, ORDER_QUEUE_BY_SEQ_INDEX, getOfflineDb, isQuotaExceededError, getInstanceKey } from './idbStore'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'

export const MAX_QUEUE_SIZE = 5

export type QueueStatus = 'pending' | 'draining' | 'failed'

export interface QueueFiscal {
  code: string
  date: string
  serial: string
}

export interface QueueEntry {
  id: string          // saleAttemptId / x_fex_id — idempotencia
  seq: number          // orden FIFO monotónico
  payload: unknown      // payload EXACTO a reenviar (nunca se reconstruye)
  fiscal: QueueFiscal | null
  status: QueueStatus
  attempts: number
  lastError: string | null
  enqueuedAt: number
  instanceKey?: string | undefined  // ausente = entrada legacy pre-scoping (design ADR-6); se taggea lazily
}

// Instance scoping (design ADR-6): normaliza undefined/null a null antes de
// comparar, así una entrada legacy (sin instanceKey) solo matchea mientras
// nadie la haya tagueado todavía Y el kiosko tampoco tenga instancia
// configurada; en la práctica `tagLegacyEntries()` corre en el boot ANTES de
// cualquier lectura real, así que las legacy ya están tagueadas para cuando
// esta función importa.
export function matchesInstance(entry: QueueEntry, instanceKey: string | null): boolean {
  return (entry.instanceKey ?? null) === (instanceKey ?? null)
}

export class QueueFullError extends Error {
  constructor() {
    super(`La cola offline ya tiene ${MAX_QUEUE_SIZE} órdenes pendientes`)
    this.name = 'QueueFullError'
  }
}

// Enqueue atómico: cuenta + valida cupo + calcula el próximo seq dentro de
// UNA sola transacción readwrite, para que dos intentos concurrentes no
// pisen el límite (aunque el kiosko drena/vende de a una orden a la vez)
export async function enqueue(id: string, payload: unknown): Promise<QueueEntry> {
  const instanceKey = getInstanceKey()
  const db = await getOfflineDb()
  const tx = db.transaction(ORDER_QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(ORDER_QUEUE_STORE)

  // Bound per-instance (design ADR-6): una cola llena de OTRA instancia no
  // debe bloquear a la actual, así que se cuenta solo lo que matchea la
  // instancia vigente en vez de usar store.count() (que cuenta todo).
  const allEntries = (await store.getAll()) as QueueEntry[]
  const currentInstanceCount = allEntries.filter((e) => matchesInstance(e, instanceKey)).length
  if (currentInstanceCount >= MAX_QUEUE_SIZE) {
    tx.abort()
    // idb rechaza tx.done con AbortError al abortar — se consume acá para no
    // dejar una promesa rechazada sin manejar (unhandled rejection)
    tx.done.catch(() => {})
    throw new QueueFullError()
  }

  const cursor = await store.index(ORDER_QUEUE_BY_SEQ_INDEX).openCursor(null, 'prev')
  const nextSeq = cursor ? (cursor.value as QueueEntry).seq + 1 : 0

  const entry: QueueEntry = {
    id,
    seq: nextSeq,
    payload,
    fiscal: null,
    status: 'pending',
    attempts: 0,
    lastError: null,
    enqueuedAt: Date.now(),
    instanceKey: instanceKey ?? undefined
  }

  try {
    await store.add(entry)
    await tx.done
  } catch (err) {
    if (isQuotaExceededError(err)) throw err
    throw err
  }

  await hydrateCount()
  return entry
}

export async function peekAll(): Promise<QueueEntry[]> {
  const db = await getOfflineDb()
  return db.getAllFromIndex(ORDER_QUEUE_STORE, ORDER_QUEUE_BY_SEQ_INDEX) as Promise<QueueEntry[]>
}

export async function patchFiscal(id: string, fiscal: QueueFiscal): Promise<void> {
  const db = await getOfflineDb()
  const entry = await db.get(ORDER_QUEUE_STORE, id) as QueueEntry | undefined
  if (!entry) return
  await db.put(ORDER_QUEUE_STORE, { ...entry, fiscal })
}

export async function dequeue(id: string): Promise<void> {
  const db = await getOfflineDb()
  await db.delete(ORDER_QUEUE_STORE, id)
  await hydrateCount()
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getOfflineDb()
  const entry = await db.get(ORDER_QUEUE_STORE, id) as QueueEntry | undefined
  if (!entry) return
  await db.put(ORDER_QUEUE_STORE, { ...entry, status: 'failed', attempts: entry.attempts + 1, lastError: error })
}

export async function markStatus(id: string, status: QueueStatus): Promise<void> {
  const db = await getOfflineDb()
  const entry = await db.get(ORDER_QUEUE_STORE, id) as QueueEntry | undefined
  if (!entry) return
  await db.put(ORDER_QUEUE_STORE, { ...entry, status })
}

// Reintento manual (Menú Avanzado > Cola Offline): una entrada 'failed'
// vuelve a 'pending' para que drain() la reintente. Solo aplica a entradas
// realmente 'failed' — no toca pending/draining, que ya están bajo control
// del synchronizer.
export async function requeueFailed(id: string): Promise<void> {
  const db = await getOfflineDb()
  const entry = await db.get(ORDER_QUEUE_STORE, id) as QueueEntry | undefined
  if (!entry || entry.status !== 'failed') return
  await db.put(ORDER_QUEUE_STORE, { ...entry, status: 'pending', lastError: null })
}

export async function hydrateCount(): Promise<number> {
  const instanceKey = getInstanceKey()
  const all = await peekAll()
  const count = all.filter((e) => matchesInstance(e, instanceKey)).length
  useOfflineQueueStore.getState().setCount(count)
  return count
}

// Recuperación de arranque (spec: App Restart Mid-Drain Recovery): si el
// kiosko se reinició a mitad de un drain, la entrada que quedó en 'draining'
// no fue confirmada ni removida — se vuelve a 'pending' para reintentarla.
// Scoped a la instancia actual (design ADR-6): una entrada 'draining' de otra
// instancia queda dormida, no se toca.
export async function resetDrainingToPending(): Promise<void> {
  const instanceKey = getInstanceKey()
  const all = await peekAll()
  const db = await getOfflineDb()
  for (const entry of all) {
    if (entry.status === 'draining' && matchesInstance(entry, instanceKey)) {
      await db.put(ORDER_QUEUE_STORE, { ...entry, status: 'pending' })
    }
  }
}

// Migración lazy (design ADR-6): entradas persistidas ANTES de esta
// amendment no tienen `instanceKey`. Se taggean con la instancia vigente la
// PRIMERA vez que se bootea contra ella después del upgrade — a partir de
// ahí quedan fijas a esa instancia aunque el kiosko se reconfigure después.
// No-op si el kiosko arranca sin instancia configurada.
export async function tagLegacyEntries(): Promise<void> {
  const instanceKey = getInstanceKey()
  if (instanceKey === null) return
  const all = await peekAll()
  const db = await getOfflineDb()
  for (const entry of all) {
    if (entry.instanceKey === undefined) {
      await db.put(ORDER_QUEUE_STORE, { ...entry, instanceKey })
    }
  }
}
