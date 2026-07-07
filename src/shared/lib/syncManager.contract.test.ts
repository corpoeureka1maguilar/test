// Contrato drain() <-> odooRepository (mirror del patrón de
// cardTerminal.contract.test.ts): documenta, como spec ejecutable, la forma
// EXACTA en que el synchronizer llama a la capa de Odoo al reenviar una venta
// encolada — para que un futuro refactor de odooRepository no rompa
// silenciosamente la reconciliación de la cola offline (spec: No Duplicate
// Submissions).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DB_NAME, resetOfflineDbForTests } from './idbStore'
import { enqueue, peekAll, patchFiscal } from './orderQueue'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { useConfigStore } from '@/shared/stores/config'
import { drain, resetSyncManagerForTests } from './syncManager'

vi.mock('@/shared/lib/odooRepository', () => ({
  createSaleOrder: vi.fn(),
  setOrderPrinterData: vi.fn().mockResolvedValue(undefined),
  pingStation: vi.fn()
}))

import { createSaleOrder, setOrderPrinterData } from '@/shared/lib/odooRepository'

const createSaleOrderMock = vi.mocked(createSaleOrder)
const setOrderPrinterDataMock = vi.mocked(setOrderPrinterData)

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
  useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
  resetSyncManagerForTests()
  createSaleOrderMock.mockReset()
  setOrderPrinterDataMock.mockReset().mockResolvedValue(undefined)
})

describe('syncManager.contract — drain() <-> odooRepository', () => {
  it('calls createSaleOrder with exactly ONE argument: the stored payload verbatim (no wrapping, no second arg)', async () => {
    const payload = { x_fex_id: 'abc-1', partner_id: 5, lines: [{ product: 1, qty: 2 }] }
    await enqueue('abc-1', payload)
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })

    await drain()

    expect(createSaleOrderMock).toHaveBeenCalledTimes(1)
    expect(createSaleOrderMock.mock.calls[0]).toHaveLength(1)
    expect(createSaleOrderMock).toHaveBeenCalledWith(payload)
  })

  it('calls setOrderPrinterData(orderId, code, date, serial) in that exact positional order', async () => {
    await enqueue('a', { n: 1 })
    await patchFiscal('a', { code: 'C-1', date: '2026-07-06', serial: 'S-1' })
    createSaleOrderMock.mockResolvedValueOnce({ id: 7 })

    await drain()

    expect(setOrderPrinterDataMock).toHaveBeenCalledTimes(1)
    expect(setOrderPrinterDataMock).toHaveBeenCalledWith(7, 'C-1', '2026-07-06', 'S-1')
  })

  it('does NOT call setOrderPrinterData when the queued entry has no fiscal data yet', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 7 })

    await drain()

    expect(setOrderPrinterDataMock).not.toHaveBeenCalled()
  })

  it('never calls createSaleOrder for an item once it has been dequeued (no duplicate submissions)', async () => {
    await enqueue('a', { n: 1 })
    createSaleOrderMock.mockResolvedValueOnce({ id: 1 })

    await drain()
    await drain() // segundo drain sobre una cola ya vacía

    expect(createSaleOrderMock).toHaveBeenCalledTimes(1)
  })

  it('re-entrant drain() calls while one is already in flight are no-ops (never double-submits)', async () => {
    await enqueue('a', { n: 1 })
    let resolveCreate: (v: { id: number }) => void = () => {}
    createSaleOrderMock.mockImplementationOnce(
      () => new Promise((res) => { resolveCreate = res })
    )

    const first = drain()
    // Esperar a que el primer drain() llegue realmente a createSaleOrder
    // antes de disparar el segundo — si no, el segundo podría arrancar
    // mientras el primero sigue resolviendo el peekAll() inicial y ninguno
    // de los dos habría marcado `draining` todavía de forma observable
    await vi.waitFor(() => expect(createSaleOrderMock).toHaveBeenCalledTimes(1))
    const second = drain()

    resolveCreate({ id: 1 })
    await Promise.all([first, second])

    expect(createSaleOrderMock).toHaveBeenCalledTimes(1)
    expect(await peekAll()).toHaveLength(0)
  })
})
