import { describe, it, expect, beforeEach } from 'vitest'
import {
  DB_NAME,
  CATALOG_STORE,
  ORDER_QUEUE_STORE,
  getOfflineDb,
  putCapped,
  getAllRecords,
  isQuotaExceededError,
  resetOfflineDbForTests
} from './idbStore'

async function deleteOfflineDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  resetOfflineDbForTests()
  await deleteOfflineDb()
})

describe('idbStore', () => {
  it('opens/upgrades the DB creating catalog and orderQueue object stores', async () => {
    const db = await getOfflineDb()
    expect(db.objectStoreNames.contains(CATALOG_STORE)).toBe(true)
    expect(db.objectStoreNames.contains(ORDER_QUEUE_STORE)).toBe(true)
  })

  it('putCapped writes a record that can be read back', async () => {
    const ok = await putCapped(CATALOG_STORE, { kind: 'products', items: [1, 2, 3], updatedAt: Date.now() })
    expect(ok).toBe(true)

    const all = await getAllRecords<{ kind: string; items: number[] }>(CATALOG_STORE)
    expect(all).toHaveLength(1)
    expect(all[0].items).toEqual([1, 2, 3])
  })

  it('isQuotaExceededError recognizes a DOMException named QuotaExceededError', () => {
    const err = new DOMException('quota', 'QuotaExceededError')
    expect(isQuotaExceededError(err)).toBe(true)
    expect(isQuotaExceededError(new Error('other'))).toBe(false)
  })

  it('putCapped keeps prior data when the write is rejected by a quota error', async () => {
    await putCapped(CATALOG_STORE, { kind: 'products', items: [1], updatedAt: 1 })

    const db = await getOfflineDb()
    const originalPut = db.put.bind(db)
    // Simula QuotaExceededError forzando el rechazo del próximo put sobre 'catalog'
    const patchedPut: typeof db.put = ((storeName: string, value: unknown, key?: IDBValidKey) => {
      if (storeName === CATALOG_STORE) {
        return Promise.reject(new DOMException('quota', 'QuotaExceededError'))
      }
      return originalPut(storeName as never, value as never, key)
    }) as typeof db.put
    db.put = patchedPut

    const ok = await putCapped(CATALOG_STORE, { kind: 'products', items: [1, 2, 3, 4], updatedAt: 2 })
    expect(ok).toBe(false)

    const all = await getAllRecords<{ kind: string; items: number[] }>(CATALOG_STORE)
    expect(all).toHaveLength(1)
    expect(all[0].items).toEqual([1])
  })
})
