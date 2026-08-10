import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./odooRepository', () => ({
  fetchKioskAdminSnapshot: vi.fn(),
  logKioskAudit: vi.fn()
}))

import { DB_NAME, resetOfflineDbForTests, AUDIT_QUEUE_STORE, getAllRecords } from './idbStore'
import { fetchKioskAdminSnapshot, logKioskAudit } from './odooRepository'
import { iteratedHash } from './cryptoUtils'
import {
  refreshAdminSnapshot,
  getAdminSnapshot,
  verifyAdminOffline,
  getPendingAudit,
  flushAuditQueue
} from './adminSnapshot'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'

const fetchMock = fetchKioskAdminSnapshot as ReturnType<typeof vi.fn>
const logMock = logKioskAudit as ReturnType<typeof vi.fn>

const SALT = 'deadbeefdeadbeef'
// Pocas iteraciones a propósito: el conteo real (50k) lo manda Odoo dentro del
// snapshot, así que acá se puede bajar sin perder cobertura y sin que cada
// assert cueste medio segundo de SHA-256 en JS puro
const ITERATIONS = 3

const SALE_RETURN = 'eu_pos_permission_levels.x_pos_audit_sale_return'
const SESSION_CLOSE = 'eu_pos_permission_levels.x_pos_audit_session_close'

const TTL_MS = 30 * 60 * 1000

function snapshotFixture(overrides: Record<string, unknown> = {}) {
  return {
    salt: SALT,
    iterations: ITERATIONS,
    ttlMs: TTL_MS,
    usePermissionLevels: true,
    admins: [
      {
        cashierId: 3,
        name: 'Ana',
        passwordHash: iteratedHash('1234', SALT, ITERATIONS),
        operations: [SALE_RETURN]
      },
      {
        cashierId: 9,
        name: 'Beto',
        passwordHash: iteratedHash('5678', SALT, ITERATIONS),
        operations: [SALE_RETURN, SESSION_CLOSE]
      }
    ],
    ...overrides
  }
}

async function deleteOfflineDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  vi.useRealTimers()
  fetchMock.mockReset()
  logMock.mockReset()
  resetOfflineDbForTests()
  await deleteOfflineDb()
  useConfigStore.setState({
    isConfigured: true,
    odooUrl: 'https://odoo.test',
    odooDb: 'test-db',
    stationId: 1,
    branchId: 7
  })
  useSessionStore.setState({ sessionId: 42 })
})

describe('adminSnapshot — refresh y vigencia', () => {
  it('guarda el snapshot de la sucursal configurada', async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())

    expect(await refreshAdminSnapshot()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(7)

    const row = await getAdminSnapshot()
    expect(row?.admins).toHaveLength(2)
    expect(row?.salt).toBe(SALT)
  })

  it('no consulta a Odoo si el kiosco no está configurado o no tiene sucursal', async () => {
    useConfigStore.setState({ branchId: 0 })
    expect(await refreshAdminSnapshot()).toBe(false)

    useConfigStore.setState({ branchId: 7, isConfigured: false })
    expect(await refreshAdminSnapshot()).toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  // El TTL es la razón de ser del snapshot: cachear para siempre significaría
  // que una rotación de password o un permiso revocado nunca llegan al kiosco
  it('deja de servir el snapshot pasado el TTL', async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())
    await refreshAdminSnapshot()
    expect(await getAdminSnapshot()).not.toBeNull()

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL_MS + 1_000)
    expect(await getAdminSnapshot()).toBeNull()
  })

  it('sigue sirviendo el snapshot justo antes de vencer', async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())
    await refreshAdminSnapshot()

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL_MS - 1_000)
    expect(await getAdminSnapshot()).not.toBeNull()
  })

  // Si la caja se re-vincula a otra estación o base, los admins cacheados
  // pueden no corresponder: el snapshot viejo no se sirve más
  it('no sirve un snapshot de otra instancia', async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())
    await refreshAdminSnapshot()

    useConfigStore.setState({ stationId: 99 })
    expect(await getAdminSnapshot()).toBeNull()
  })
})

describe('adminSnapshot — validación offline', () => {
  beforeEach(async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())
    await refreshAdminSnapshot()
  })

  it('acepta el admin_password de un admin con permiso para la operación', async () => {
    const res = await verifyAdminOffline('1234', SALE_RETURN)
    expect(res).toMatchObject({ ok: true, approverCashierId: 3, approverName: 'Ana' })
  })

  it('rechaza un password que no corresponde a ningún admin', async () => {
    expect(await verifyAdminOffline('0000', SALE_RETURN)).toEqual({ ok: false, error: 'admin_not_found' })
  })

  it('respeta el permiso por operación igual que Odoo', async () => {
    expect(await verifyAdminOffline('1234', SESSION_CLOSE)).toEqual({ ok: false, error: 'no_allowed' })
    expect(await verifyAdminOffline('5678', SESSION_CLOSE)).toMatchObject({ ok: true, approverCashierId: 9 })
  })

  it('con niveles de permiso apagados, cualquier admin aprueba cualquier operación', async () => {
    resetOfflineDbForTests()
    await deleteOfflineDb()
    fetchMock.mockResolvedValueOnce(snapshotFixture({ usePermissionLevels: false }))
    await refreshAdminSnapshot()

    expect(await verifyAdminOffline('1234', SESSION_CLOSE)).toMatchObject({ ok: true, approverCashierId: 3 })
  })

  it('no aprueba nada cuando el snapshot venció', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL_MS + 1_000)
    expect(await verifyAdminOffline('1234', SALE_RETURN)).toEqual({ ok: false, error: 'snapshot_unavailable' })
  })
})

describe('adminSnapshot — auditoría de aprobaciones offline', () => {
  beforeEach(async () => {
    fetchMock.mockResolvedValueOnce(snapshotFixture())
    await refreshAdminSnapshot()
  })

  // Sin esto, mover la fuente de verdad a Odoo costaría el rastro de auditoría
  // justo en el escenario offline — que es el que más importa auditar
  it('encola la aprobación con el aprobador, la operación y la sesión', async () => {
    await verifyAdminOffline('5678', SESSION_CLOSE, 'Cierre Z')

    const pending = await getPendingAudit()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      operationRef: SESSION_CLOSE,
      approverCashierId: 9,
      sessionId: 42,
      message: 'Cierre Z'
    })
    expect(pending[0]?.localId).toBeTruthy()
    expect(Date.parse(pending[0]?.approvedAt ?? '')).not.toBeNaN()
  })

  it('no encola nada cuando la validación falla', async () => {
    await verifyAdminOffline('0000', SALE_RETURN)
    expect(await getPendingAudit()).toHaveLength(0)
  })

  it('borra solo las entradas que Odoo confirmó', async () => {
    await verifyAdminOffline('1234', SALE_RETURN)
    await verifyAdminOffline('5678', SESSION_CLOSE)

    const pending = await getPendingAudit()
    expect(pending).toHaveLength(2)
    logMock.mockResolvedValueOnce({ loggedIds: [pending[0]?.localId] })

    expect(await flushAuditQueue()).toBe(1)

    const left = await getAllRecords<{ localId: string }>(AUDIT_QUEUE_STORE)
    expect(left).toHaveLength(1)
    expect(left[0]?.localId).toBe(pending[1]?.localId)
  })

  it('no llama a Odoo con la cola vacía', async () => {
    expect(await flushAuditQueue()).toBe(0)
    expect(logMock).not.toHaveBeenCalled()
  })
})
