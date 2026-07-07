import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DB_NAME, resetOfflineDbForTests, getOfflineDb } from './idbStore'
import { enqueue, peekAll, patchFiscal } from './orderQueue'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { useConfigStore } from '@/shared/stores/config'
import { OdooServerError } from './odooEnv'
import {
  drain,
  initSyncManager,
  resetSyncManagerForTests,
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS
} from './syncManager'

vi.mock('@/shared/lib/odooRepository', () => ({
  createSaleOrder: vi.fn(),
  setOrderPrinterData: vi.fn().mockResolvedValue(undefined),
  pingStation: vi.fn()
}))

import { createSaleOrder, setOrderPrinterData, pingStation } from '@/shared/lib/odooRepository'

const createSaleOrderMock = vi.mocked(createSaleOrder)
const setOrderPrinterDataMock = vi.mocked(setOrderPrinterData)
const pingStationMock = vi.mocked(pingStation)

const fakeStation = {
  id: 1, name: 'ST', code: 'C', branchId: 0, companyId: 0,
  activeSessionId: false as const, operateWithoutPrinter: false, allowLocalDB: false
}

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
  useOfflineQueueStore.setState({ count: 0 })
  useConfigStore.setState({
    isOffline: false,
    isConnectionReady: true,
    isConfigured: true,
    odooUrl: 'https://odoo.test',
    odooDb: 'test-db',
    stationId: 1
  })
  resetSyncManagerForTests()
  createSaleOrderMock.mockReset()
  setOrderPrinterDataMock.mockReset().mockResolvedValue(undefined)
  pingStationMock.mockReset()
})

describe('syncManager.drain — FIFO order + idempotent resend', () => {
  it('drains items in FIFO order and empties the queue', async () => {
    await enqueue('a', { seq: 'a' })
    await enqueue('b', { seq: 'b' })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 })

    await drain()

    expect(createSaleOrderMock).toHaveBeenNthCalledWith(1, { seq: 'a' })
    expect(createSaleOrderMock).toHaveBeenNthCalledWith(2, { seq: 'b' })
    expect(await peekAll()).toHaveLength(0)
  })

  it('resends the exact stored payload object verbatim (no rebuild)', async () => {
    const payload = { id: 'x', lines: [{ p: 1 }] }
    await enqueue('x', payload)
    createSaleOrderMock.mockResolvedValueOnce({ id: 99 })

    await drain()

    expect(createSaleOrderMock).toHaveBeenCalledWith(payload)
  })

  it('registers the printer fiscal data after successfully creating the order', async () => {
    await enqueue('a', { n: 1 })
    await patchFiscal('a', { code: '001', date: '2026-07-06', serial: 'A1' })
    createSaleOrderMock.mockResolvedValueOnce({ id: 42 })

    await drain()

    expect(setOrderPrinterDataMock).toHaveBeenCalledWith(42, '001', '2026-07-06', 'A1')
  })
})

describe('syncManager.drain — ADR-3 partial-failure semantics', () => {
  it('marks a permanently-rejected item failed and continues draining the rest', async () => {
    await enqueue('a', { n: 1 })
    await enqueue('b', { n: 2 })
    createSaleOrderMock
      .mockRejectedValueOnce(new OdooServerError('Cliente bloqueado'))
      .mockResolvedValueOnce({ id: 2 })

    await drain()

    const all = await peekAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('a')
    expect(all[0].status).toBe('failed')
    expect(all[0].attempts).toBe(1)
  })

  it('reverts a transiently-failed item to pending and stops the drain', async () => {
    await enqueue('a', { n: 1 })
    await enqueue('b', { n: 2 })
    createSaleOrderMock.mockRejectedValueOnce(new Error('Network error'))

    await drain()

    const all = await peekAll()
    expect(all.map((e) => e.id)).toEqual(['a', 'b'])
    expect(all[0].status).toBe('pending')
    expect(createSaleOrderMock).toHaveBeenCalledTimes(1)
  })
})

describe('syncManager — boot recovery (App Restart Mid-Drain Recovery)', () => {
  it('resets a stuck draining entry back to pending and resumes the drain on init', async () => {
    await enqueue('a', { n: 1 })
    const db = await getOfflineDb()
    await db.put('orderQueue', { ...(await db.get('orderQueue', 'a')), status: 'draining' })
    createSaleOrderMock.mockResolvedValueOnce({ id: 500 })

    await initSyncManager()

    await vi.waitFor(async () => {
      expect(await peekAll()).toHaveLength(0)
    })
    expect(createSaleOrderMock).toHaveBeenCalledWith({ n: 1 })
  })
})

// NOTA: se evita deliberadamente `vi.useFakeTimers()` en este describe — la
// combinación de fake timers + fake-indexeddb (usada por drain()/peekAll())
// puede colgar el test si algún timer interno de indexedDB queda faked (ver
// gotcha documentado en apply-progress batch 1). En su lugar, se espía
// `setTimeout` puntualmente para capturar el delay y el callback programados
// por `scheduleBackoffPoll`, sin reemplazar el reloj global.
describe('syncManager — reconnection + backoff poll', () => {
  it('subscribes to isOffline true->false and drains automatically on reconnect', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })
    useConfigStore.setState({ isOffline: true })

    await initSyncManager()
    useConfigStore.setState({ isOffline: false })

    await vi.waitFor(async () => {
      expect(await peekAll()).toHaveLength(0)
    })
    expect(createSaleOrderMock).toHaveBeenCalledWith({ n: 1 })
  })

  it('a transient failure schedules a backoff poll with a delay in [0, BACKOFF_BASE_MS] on the first attempt', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockRejectedValueOnce(new Error('Network error'))
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((_fn: () => void) => 0) as unknown as typeof setTimeout)

    try {
      await drain()

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
      const delay = setTimeoutSpy.mock.calls[0][1] as number
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(BACKOFF_BASE_MS)
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  it('invoking the scheduled backoff callback pings the station then resumes the drain', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ id: 1 })
    pingStationMock.mockResolvedValueOnce(fakeStation)
    useConfigStore.setState({ stationId: 1 })

    let capturedCallback: (() => void) | undefined
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((fn: () => void) => {
        capturedCallback = fn
        return 0
      }) as unknown as typeof setTimeout)

    await drain()
    setTimeoutSpy.mockRestore()
    expect(createSaleOrderMock).toHaveBeenCalledTimes(1)

    capturedCallback?.()

    await vi.waitFor(async () => {
      expect(await peekAll()).toHaveLength(0)
    })
    expect(pingStationMock).toHaveBeenCalledWith(1)
    expect(createSaleOrderMock).toHaveBeenCalledTimes(2)
  })

  it('does not schedule a backoff poll once the queue is fully drained', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    await drain()

    expect(await peekAll()).toHaveLength(0)
    expect(setTimeoutSpy).not.toHaveBeenCalled()
    setTimeoutSpy.mockRestore()
  })

  it('caps the backoff delay at BACKOFF_CAP_MS on later attempts', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'))
      .mockRejectedValueOnce(new Error('Network error 3'))
      .mockRejectedValueOnce(new Error('Network error 4'))
      .mockRejectedValueOnce(new Error('Network error 5'))

    const delays: number[] = []
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((_fn: () => void, delay?: number) => {
        delays.push(delay ?? 0)
        return 0
      }) as unknown as typeof setTimeout)

    try {
      // 5 intentos transitorios consecutivos sin invocar el callback
      // programado (cada drain() ve la entrada 'pending' otra vez)
      for (let i = 0; i < 5; i++) {
        await drain()
      }
      for (const d of delays) {
        expect(d).toBeLessThanOrEqual(BACKOFF_CAP_MS)
      }
      // El último cap ya debería estar topado en BACKOFF_CAP_MS (5s * 2^4 = 80s > 60s cap)
      expect(delays[delays.length - 1]).toBeLessThanOrEqual(BACKOFF_CAP_MS)
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })
})

describe('syncManager — instance scoping (design ADR-6)', () => {
  it('never drains anything when the kiosk is unconfigured', async () => {
    useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
    await enqueue('a', { n: 1 })

    useConfigStore.setState({ isConfigured: false })
    await drain()

    expect(createSaleOrderMock).not.toHaveBeenCalled()
    expect(await peekAll()).toHaveLength(1)
  })

  it("never sends, fails, or deletes a foreign-instance entry — it stays dormant", async () => {
    await enqueue('a', { n: 1 })

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await drain()

    expect(createSaleOrderMock).not.toHaveBeenCalled()
    const all = await peekAll()
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('pending')
    expect(all[0].attempts).toBe(0)
  })

  it('drains the current instance own entries while a foreign entry stays dormant alongside them', async () => {
    await enqueue('foreign', { n: 0 })

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await enqueue('own', { n: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })

    await drain()

    expect(createSaleOrderMock).toHaveBeenCalledWith({ n: 1 })
    const all = await peekAll()
    expect(all.map((e) => e.id)).toEqual(['foreign'])
  })

  it('reconfiguring back to the original instance resumes draining its dormant entries', async () => {
    await enqueue('a', { n: 1 })

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await drain()
    expect(createSaleOrderMock).not.toHaveBeenCalled()

    useConfigStore.setState({ odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })
    await drain()

    expect(createSaleOrderMock).toHaveBeenCalledWith({ n: 1 })
    expect(await peekAll()).toHaveLength(0)
  })

  it('initSyncManager tags legacy untagged entries with the current instance and drains them normally', async () => {
    await enqueue('a', { n: 1 })
    const db = await getOfflineDb()
    const raw = await db.get('orderQueue', 'a')
    delete raw.instanceKey
    await db.put('orderQueue', raw)
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })

    await initSyncManager()

    await vi.waitFor(async () => {
      expect(await peekAll()).toHaveLength(0)
    })
    expect(createSaleOrderMock).toHaveBeenCalledWith({ n: 1 })
  })
})
