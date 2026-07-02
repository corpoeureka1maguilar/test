import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConfigStore } from './config'
import { useUIStore } from '@/shared/stores/ui'
import { OdooServerError } from '@/shared/lib/odooEnv'
import { pingStation } from '@/shared/lib/odooRepository'

// jsdom no tiene indexedDB; en el kiosko real (Chrome) siempre existe
vi.mock('@/shared/lib/secureStorage', () => ({
  saveSecret: vi.fn().mockResolvedValue(undefined),
  loadSecret: vi.fn().mockResolvedValue(''),
  deleteSecret: vi.fn()
}))

vi.mock('@/shared/lib/odooRepository', () => ({
  linkStation: vi.fn(),
  pingStation: vi.fn(),
  fetchCompanyLogo: vi.fn().mockResolvedValue(''),
  fetchBranchState: vi.fn().mockResolvedValue(''),
  fetchBranchFixedProducts: vi.fn().mockResolvedValue([])
}))

vi.mock('@/shared/lib/odooEnv', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/lib/odooEnv')>()
  return {
    ...original,
    odooEnv: {
      setupConnection: vi.fn(),
      authenticate: vi.fn().mockResolvedValue(2),
      disconnect: vi.fn(),
      uid: 2
    }
  }
})

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

const configuredState = {
  odooUrl: 'https://odoo.test',
  odooDb: 'test_db',
  serviceUser: 'kiosko@test.com',
  servicePassword: 'secret',
  stationId: 42,
  stationName: 'Caja 1',
  branchId: 7,
  isConfigured: true,
  isConnectionReady: false
}

beforeEach(() => {
  vi.clearAllMocks()
  useUIStore.setState({ toasts: [] })
  useConfigStore.setState(configuredState)
})

describe('config — reauthenticate', () => {
  it('unlinks the station and stops retrying when Odoo says the record was deleted', async () => {
    // Escenario fatal reportado: duplican la estación en Odoo y borran la
    // original → pingStation revienta con MissingError en cada reintento y la
    // caja queda bloqueada para siempre
    vi.mocked(pingStation).mockRejectedValue(
      new OdooServerError('Record does not exist or has been deleted.', 'odoo.exceptions.MissingError')
    )

    // No relanza: el loop de backoff no debe seguir reintentando un error permanente
    await expect(useConfigStore.getState().reauthenticate()).resolves.toBeUndefined()

    const state = useConfigStore.getState()
    expect(state.isConfigured).toBe(false)   // RequireConfig manda a /setup
    expect(state.stationId).toBe(0)          // el token vuelve a ser obligatorio
    expect(state.stationName).toBe('')
    expect(state.isConnectionReady).toBe(false)
    // Las credenciales se conservan para que el operador solo re-vincule
    expect(state.odooUrl).toBe('https://odoo.test')
    expect(state.serviceUser).toBe('kiosko@test.com')

    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].sticky).toBe(true)
  })

  it('keeps the station linked and rethrows on transient errors so the backoff retries', async () => {
    vi.mocked(pingStation).mockRejectedValue(new Error('Network unreachable'))

    await expect(useConfigStore.getState().reauthenticate()).rejects.toThrow('Network unreachable')

    const state = useConfigStore.getState()
    expect(state.isConfigured).toBe(true)
    expect(state.stationId).toBe(42)
    expect(state.isConnectionReady).toBe(false)
  })

  it('marks the connection ready when the station ping succeeds', async () => {
    vi.mocked(pingStation).mockResolvedValue({
      id: 42, name: 'Caja 1', code: 'C1', branchId: 7, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })

    await useConfigStore.getState().reauthenticate()

    expect(useConfigStore.getState().isConnectionReady).toBe(true)
    expect(useConfigStore.getState().isConfigured).toBe(true)
  })
})
