import { describe, it, expect, beforeEach } from 'vitest'
import { DB_NAME, resetOfflineDbForTests, getOfflineDb } from './idbStore'
import {
  MAX_QUEUE_SIZE,
  enqueue,
  peekAll,
  patchFiscal,
  dequeue,
  hydrateCount,
  resetDrainingToPending,
  tagLegacyEntries,
  matchesInstance,
  markFailed,
  requeueFailed,
  QueueFullError,
  type QueueEntry
} from './orderQueue'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { useConfigStore } from '@/shared/stores/config'

async function deleteOfflineDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  resetOfflineDbForTests()
  await deleteOfflineDb()
  useOfflineQueueStore.setState({ count: 0 })
  useConfigStore.setState({ isConfigured: true, odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
})

describe('orderQueue — bounded FIFO', () => {
  it('enqueues below the cap and returns the created entry', async () => {
    const entry = await enqueue('x-fex-1', { a: 1 })
    expect(entry.id).toBe('x-fex-1')
    expect(entry.status).toBe('pending')
    expect(entry.fiscal).toBeNull()
    expect(entry.seq).toBe(0)
  })

  it('assigns increasing seq numbers preserving FIFO order', async () => {
    await enqueue('a', { n: 1 })
    await enqueue('b', { n: 2 })
    await enqueue('c', { n: 3 })

    const all = await peekAll()
    expect(all.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(all.map((e) => e.seq)).toEqual([0, 1, 2])
  })

  it('rejects enqueue once the queue holds MAX_QUEUE_SIZE entries', async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      await enqueue(`id-${i}`, { i })
    }
    await expect(enqueue('overflow', { i: 999 })).rejects.toThrow(QueueFullError)

    const all = await peekAll()
    expect(all).toHaveLength(MAX_QUEUE_SIZE)
  })

  it('resends the exact stored payload object (idempotency key reuse)', async () => {
    const payload = { id: 'abc-123', lines: [{ product: 1 }] }
    await enqueue('abc-123', payload)

    const [entry] = await peekAll()
    expect(entry!.payload).toEqual(payload)
  })

  it('patchFiscal stores the printer result on the queue entry', async () => {
    await enqueue('a', { n: 1 })
    await patchFiscal('a', { code: '001', date: '2026-07-06', serial: 'A1' })

    const [entry] = await peekAll()
    expect(entry!.fiscal).toEqual({ code: '001', date: '2026-07-06', serial: 'A1' })
  })

  it('dequeue removes the entry from the queue', async () => {
    await enqueue('a', { n: 1 })
    await enqueue('b', { n: 2 })
    await dequeue('a')

    const all = await peekAll()
    expect(all.map((e) => e.id)).toEqual(['b'])
  })

  it('hydrateCount reads the persisted queue length into the Zustand mirror', async () => {
    await enqueue('a', { n: 1 })
    await enqueue('b', { n: 2 })

    const count = await hydrateCount()
    expect(count).toBe(2)
    expect(useOfflineQueueStore.getState().count).toBe(2)
  })

  it('requeueFailed reverts a failed entry to pending and clears lastError', async () => {
    await enqueue('a', { n: 1 })
    await markFailed('a', 'Cliente bloqueado')

    await requeueFailed('a')

    const [entry] = await peekAll()
    expect(entry!.status).toBe('pending')
    expect(entry!.lastError).toBeNull()
  })

  it('requeueFailed is a no-op on a pending entry (does not touch attempts or status)', async () => {
    await enqueue('a', { n: 1 })

    await requeueFailed('a')

    const [entry] = await peekAll()
    expect(entry!.status).toBe('pending')
    expect(entry!.attempts).toBe(0)
  })

  it('requeueFailed is a no-op when the id does not exist', async () => {
    await expect(requeueFailed('missing')).resolves.toBeUndefined()
  })

  it('resetDrainingToPending resets any draining entry back to pending on boot', async () => {
    await enqueue('a', { n: 1 })
    const db = await (await import('./idbStore')).getOfflineDb()
    await db.put('orderQueue', { ...(await db.get('orderQueue', 'a')), status: 'draining' })

    await resetDrainingToPending()

    const [entry] = await peekAll()
    expect(entry!.status).toBe('pending')
  })
})

describe('orderQueue — instance scoping (design ADR-6)', () => {
  it('tags every enqueued entry with the current instanceKey', async () => {
    const entry = await enqueue('a', { n: 1 })
    expect(entry.instanceKey).toBe('https://odoo.test|test-db|1')
  })

  it("a different instance's full queue does not block the current instance", async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      await enqueue(`a-${i}`, { i })
    }

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })

    const entry = await enqueue('b-0', { i: 0 })
    expect(entry.instanceKey).toBe('https://other.test|other-db|2')

    const all = await peekAll()
    expect(all).toHaveLength(MAX_QUEUE_SIZE + 1)
  })

  it("the current instance's own full queue still rejects new entries regardless of other instances", async () => {
    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await enqueue('other-1', { i: 0 })

    useConfigStore.setState({ odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      await enqueue(`a-${i}`, { i })
    }

    await expect(enqueue('overflow', { i: 999 })).rejects.toThrow(QueueFullError)
  })

  it('hydrateCount mirrors only the current instance pending count', async () => {
    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await enqueue('other-1', { i: 0 })
    await enqueue('other-2', { i: 1 })

    useConfigStore.setState({ odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
    await enqueue('a', { i: 0 })

    const count = await hydrateCount()
    expect(count).toBe(1)
    expect(useOfflineQueueStore.getState().count).toBe(1)
  })

  it('resetDrainingToPending only resets draining entries for the current instance', async () => {
    await enqueue('a', { n: 1 })
    const db = await getOfflineDb()
    await db.put('orderQueue', { ...(await db.get('orderQueue', 'a')), status: 'draining' })

    useConfigStore.setState({ odooUrl: 'https://other.test', odooDb: 'other-db', stationId: 2 })
    await resetDrainingToPending()

    const [entry] = await peekAll()
    expect(entry!.status).toBe('draining')

    useConfigStore.setState({ odooUrl: 'https://odoo.test', odooDb: 'test-db', stationId: 1 })
    await resetDrainingToPending()

    const [entryAfter] = await peekAll()
    expect(entryAfter!.status).toBe('pending')
  })

  it('tagLegacyEntries stamps untagged entries with the current instance', async () => {
    await enqueue('a', { n: 1 })
    const db = await getOfflineDb()
    const raw = (await db.get('orderQueue', 'a')) as QueueEntry
    delete (raw as { instanceKey?: string }).instanceKey
    await db.put('orderQueue', raw)

    await tagLegacyEntries()

    const [entry] = await peekAll()
    expect(entry!.instanceKey).toBe('https://odoo.test|test-db|1')
  })

  it('tagLegacyEntries is a no-op when the kiosk is unconfigured', async () => {
    await enqueue('a', { n: 1 })
    const db = await getOfflineDb()
    const raw = (await db.get('orderQueue', 'a')) as QueueEntry
    delete (raw as { instanceKey?: string }).instanceKey
    await db.put('orderQueue', raw)

    useConfigStore.setState({ isConfigured: false })
    await tagLegacyEntries()

    const [entry] = await peekAll()
    expect(entry!.instanceKey).toBeUndefined()
  })

  it('matchesInstance treats an untagged entry and a null current instance as matching (same "no instance" bucket)', () => {
    const entry = { instanceKey: undefined } as unknown as QueueEntry
    expect(matchesInstance(entry, null)).toBe(true)
    expect(matchesInstance(entry, 'x')).toBe(false)
  })
})
