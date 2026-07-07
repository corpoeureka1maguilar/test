// Almacenamiento offline del kiosko (caché de catálogo + cola de órdenes
// pendientes de sincronizar) — base para offlineCache.ts y orderQueue.ts.
//
// Usa `idb` (wrapper promise-based sobre IndexedDB) en una base SEPARADA de
// `autopay-secure` (ver secureStorage.ts): distinto ciclo de vida, distinto
// riesgo (borrar esta DB nunca debe afectar las credenciales cifradas).

import { openDB, type IDBPDatabase } from 'idb'
import { useConfigStore } from '@/shared/stores/config'

export const DB_NAME = 'autopay-offline'
// v2 (amendment: instance scoping, design ADR-6) — records in 'catalog' y
// 'orderQueue' ganan un campo opcional `instanceKey`; no cambia ninguna
// object store ni índice, así que `upgrade()` no necesita una rama nueva
// (las entradas viejas sin `instanceKey` se taggean lazily al leerlas, ver
// tagLegacyEntries() en orderQueue.ts y getCatalog() en offlineCache.ts)
const DB_VERSION = 2

export const CATALOG_STORE = 'catalog'
export const ORDER_QUEUE_STORE = 'orderQueue'
export const ORDER_QUEUE_BY_SEQ_INDEX = 'bySeq'

let dbPromise: Promise<IDBPDatabase> | null = null
let openDbInstance: IDBPDatabase | null = null

function openOfflineDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        // keyPath 'kind': una fila por tipo ('products' | 'paymentMethods'),
        // reemplazo atómico completo en cada refresh exitoso
        db.createObjectStore(CATALOG_STORE, { keyPath: 'kind' })
      }
      if (!db.objectStoreNames.contains(ORDER_QUEUE_STORE)) {
        // keyPath 'id' = x_fex_id (idempotencia); 'bySeq' define el orden FIFO
        const store = db.createObjectStore(ORDER_QUEUE_STORE, { keyPath: 'id' })
        store.createIndex(ORDER_QUEUE_BY_SEQ_INDEX, 'seq', { unique: true })
      }
    }
  })
}

export function getOfflineDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openOfflineDb().then((db) => {
      openDbInstance = db
      return db
    })
  }
  return dbPromise
}

// Solo para tests: cierra la conexión abierta y fuerza reabrir (cada test
// borra la DB física con indexedDB.deleteDatabase, que se queda colgado si
// queda una conexión viva apuntando a ella)
export function resetOfflineDbForTests(): void {
  openDbInstance?.close()
  openDbInstance = null
  dbPromise = null
}

export function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError'
}

// Escritura defensiva: si IndexedDB rechaza por cuota, NUNCA se pierde el
// dato previo (el store no se toca) — se loguea y se devuelve false para que
// el caller decida (p. ej. mantener el último caché bueno conocido)
export async function putCapped(storeName: string, value: unknown): Promise<boolean> {
  try {
    const db = await getOfflineDb()
    await db.put(storeName, value)
    return true
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.error(`[idbStore] QuotaExceededError al escribir en "${storeName}"; se conserva el dato anterior`, err)
      return false
    }
    throw err
  }
}

export async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await getOfflineDb()
  return db.getAll(storeName) as Promise<T[]>
}

export async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getOfflineDb()
  return db.get(storeName, key) as Promise<T | undefined>
}

export async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await getOfflineDb()
  await db.delete(storeName, key)
}

export async function countRecords(storeName: string): Promise<number> {
  const db = await getOfflineDb()
  return db.count(storeName)
}

// Identidad de instancia (design ADR-6): compone la clave UNA sola vez acá
// para que orderQueue/offlineCache/syncManager la usen sin duplicar la
// composición. `null` cuando el kiosko no está configurado — ninguna caché ni
// cola debe servirse/drenarse en ese estado.
export function getInstanceKey(): string | null {
  const { isConfigured, odooUrl, odooDb, stationId } = useConfigStore.getState()
  if (!isConfigured) return null
  return `${odooUrl}|${odooDb}|${stationId}`
}
