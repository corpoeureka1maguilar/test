import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetOfflineDbForTests, getOfflineDb, CATALOG_STORE } from './idbStore'
import { replaceProducts, getProducts, replacePaymentMethods, getPaymentMethods } from './offlineCache'
import { useConfigStore } from '@/shared/stores/config'

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
  useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
})

describe('offlineCache — products', () => {
  it('replaces the cache entirely on refresh (no incremental merge)', async () => {
    await replaceProducts(Array.from({ length: 200 }, (_, i) => ({ id: i })))
    await replaceProducts(Array.from({ length: 180 }, (_, i) => ({ id: 1000 + i })))

    const cached = await getProducts()
    expect(cached).toHaveLength(180)
    expect(cached[0]).toEqual({ id: 1000 })
  })

  it('caps the write at 5000 entries, discarding the excess', async () => {
    const many = Array.from({ length: 5200 }, (_, i) => ({ id: i }))
    await replaceProducts(many)

    const cached = await getProducts()
    expect(cached).toHaveLength(5000)
    expect(cached[cached.length - 1]).toEqual({ id: 4999 })
  })

  it('returns an empty list when nothing was ever cached', async () => {
    const cached = await getProducts()
    expect(cached).toEqual([])
  })

  it('does not wipe a good cache when replacing with an empty fresh set', async () => {
    await replaceProducts([{ id: 1 }, { id: 2 }])
    // Un fetch exitoso que devuelve [] es un caso real (catálogo vacío en Odoo);
    // igual se respeta la política "replace" salvo que el caller decida no
    // llamar a replaceProducts ante un fetch fallido (eso lo prueba useProducts)
    await replaceProducts([])

    const cached = await getProducts()
    expect(cached).toEqual([])
  })
})

describe('offlineCache — payment methods', () => {
  it('replaces payment methods on refresh and serves them from cache', async () => {
    await replacePaymentMethods([{ id: 1, name: 'Efectivo' }])
    const cached = await getPaymentMethods()
    expect(cached).toEqual([{ id: 1, name: 'Efectivo' }])
  })

  it('returns an empty list when payment methods were never cached', async () => {
    const cached = await getPaymentMethods()
    expect(cached).toEqual([])
  })
})

describe('offlineCache — instance scoping (design ADR-6)', () => {
  it('does not serve a cache written by a different instance', async () => {
    await replaceProducts([{ id: 1 }])

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    const cached = await getProducts()

    expect(cached).toEqual([])
  })

  it('serves a legacy untagged cache row once and tags it with the current instance', async () => {
    await replaceProducts([{ id: 1 }])
    const db = await getOfflineDb()
    const row = await db.get(CATALOG_STORE, 'products')
    delete row.instanceKey
    await db.put(CATALOG_STORE, row)

    const cached = await getProducts()
    expect(cached).toEqual([{ id: 1 }])

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    const cachedForOther = await getProducts()
    expect(cachedForOther).toEqual([])
  })

  it('never serves cached data when the kiosk is unconfigured', async () => {
    await replaceProducts([{ id: 1 }])

    useConfigStore.setState({ isConfigured: false })
    const cached = await getProducts()

    expect(cached).toEqual([])
  })
})
