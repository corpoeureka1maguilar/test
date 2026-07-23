import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConfigStore } from './config'
import { useUIStore } from '@/shared/stores/ui'
import { OdooServerError, odooEnv } from '@/shared/lib/odooEnv'
import { pingStation, linkStation, fetchBranchState, fetchBranchFixedProducts, fetchBranchDefaultPricelist } from '@/shared/lib/odooRepository'
import { saveSecret } from '@/shared/lib/secureStorage'
import { DEFAULT_ACCENT } from '@/shared/lib/theme'

vi.mock('@/shared/lib/theme', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/lib/theme')>()
  return {
    ...original,
    applyAccentColor: vi.fn()
  }
})

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
  fetchBranchFixedProducts: vi.fn().mockResolvedValue([]),
  fetchBranchDefaultPricelist: vi.fn().mockResolvedValue(0)
}))

vi.mock('@/shared/lib/odooEnv', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/lib/odooEnv')>()
  return {
    ...original,
    odooEnv: {
      setupConnection: vi.fn(),
      authenticate: vi.fn().mockResolvedValue(2),
      disconnect: vi.fn(),
      callMethod: vi.fn().mockResolvedValue({}),
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
    expect(toasts[0]!.sticky).toBe(true)
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

const baseSaveInput = {
  odooUrl: 'https://odoo.test',
  odooDb: 'test_db',
  serviceUser: 'kiosko@test.com',
  servicePassword: 'super-secret',
  printerUrl: 'http://127.0.0.1/ServWebImpresion/api/',
  printerModel: 'TM-T20',
  adminPin: '1234'
}

describe('config — saveConfig with token', () => {
  it('links the station and hydrates station/branch fields from the link + branch lookups', async () => {
    vi.mocked(linkStation).mockResolvedValue({
      id: 99, name: 'Caja Nueva', code: 'C9', branchId: 5, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })
    vi.mocked(fetchBranchState).mockResolvedValue('active')
    vi.mocked(fetchBranchFixedProducts).mockResolvedValue([11, 22])
    vi.mocked(fetchBranchDefaultPricelist).mockResolvedValue(3)

    await useConfigStore.getState().saveConfig({ ...baseSaveInput, configToken: 'TOKEN-123' })

    const state = useConfigStore.getState()
    expect(linkStation).toHaveBeenCalledWith('TOKEN-123', expect.any(String))
    expect(state.stationId).toBe(99)
    expect(state.stationName).toBe('Caja Nueva')
    expect(state.branchId).toBe(5)
    expect(state.branchState).toBe('active')
    expect(state.fixedProductIds).toEqual([11, 22])
    expect(state.pricelistId).toBe(3)
    expect(state.appToken).toBeTruthy()
    expect(state.isConfigured).toBe(true)
    expect(state.isConnectionReady).toBe(true)
    expect(state.isOffline).toBe(false)
  })

  it('skips branch lookups when the linked station has no branch', async () => {
    vi.mocked(linkStation).mockResolvedValue({
      id: 99, name: 'Caja Nueva', code: 'C9', branchId: 0, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })

    await useConfigStore.getState().saveConfig({ ...baseSaveInput, configToken: 'TOKEN-123' })

    expect(fetchBranchState).not.toHaveBeenCalled()
    expect(fetchBranchFixedProducts).not.toHaveBeenCalled()
    expect(fetchBranchDefaultPricelist).not.toHaveBeenCalled()
    expect(useConfigStore.getState().branchId).toBe(0)
  })
})

describe('config — saveConfig without token', () => {
  it('reconfirms credentials while preserving the already-linked station and app token', async () => {
    useConfigStore.setState({
      stationId: 42, stationName: 'Caja 1', branchId: 7, branchState: 'active',
      fixedProductIds: [1], pricelistId: 2, appToken: 'existing-token'
    })

    await useConfigStore.getState().saveConfig({ ...baseSaveInput })

    const state = useConfigStore.getState()
    expect(linkStation).not.toHaveBeenCalled()
    expect(state.stationId).toBe(42)
    expect(state.stationName).toBe('Caja 1')
    expect(state.branchId).toBe(7)
    expect(state.appToken).toBe('existing-token')
    expect(state.isConfigured).toBe(true)
  })
})

describe('config — saveConfig secret handling', () => {
  it('stores the service password via secureStorage, never in the persisted JSON', async () => {
    vi.mocked(linkStation).mockResolvedValue({
      id: 99, name: 'Caja Nueva', code: 'C9', branchId: 0, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })

    await useConfigStore.getState().saveConfig({ ...baseSaveInput, configToken: 'TOKEN-123' })

    expect(saveSecret).toHaveBeenCalledWith('service-password', 'super-secret')

    const persisted = localStorage.getItem('autopay-config') ?? ''
    expect(persisted).not.toContain('super-secret')
    expect(JSON.parse(persisted).state.servicePassword).toBeUndefined()
  })
})

describe('config — connection transitions', () => {
  it('markOnline sets the connected flag pair together', () => {
    useConfigStore.setState({ isConnectionReady: false, isOffline: true })
    useConfigStore.getState().markOnline()
    const state = useConfigStore.getState()
    expect(state.isConnectionReady).toBe(true)
    expect(state.isOffline).toBe(false)
  })

  it('markConnectionLost sets the disconnected flag pair together', () => {
    useConfigStore.setState({ isConnectionReady: true, isOffline: false })
    useConfigStore.getState().markConnectionLost()
    const state = useConfigStore.getState()
    expect(state.isConnectionReady).toBe(false)
    expect(state.isOffline).toBe(true)
  })

  it('reauthenticate uses markConnectionLost on transient errors', async () => {
    vi.mocked(pingStation).mockRejectedValue(new Error('Network unreachable'))
    await expect(useConfigStore.getState().reauthenticate()).rejects.toThrow('Network unreachable')
    const state = useConfigStore.getState()
    expect(state.isConnectionReady).toBe(false)
    expect(state.isOffline).toBe(true)
    // El caso fatal (estación borrada) NO marca offline: queda desconfigurado
    expect(state.isConfigured).toBe(true)
  })
})

describe('config — accentColor', () => {
  it('defaults to DEFAULT_ACCENT in initial state', () => {
    expect(useConfigStore.getState().accentColor).toBe(DEFAULT_ACCENT)
  })

  it('saveConfig parses x_accent_color from the custom config, normalizes it, and stores it', async () => {
    vi.mocked(linkStation).mockResolvedValue({
      id: 42, name: 'Caja 1', code: 'C1', branchId: 0, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })
    vi.mocked(odooEnv.callMethod).mockResolvedValue({ x_accent_color: '#3B82F6' })

    await useConfigStore.getState().saveConfig({
      odooUrl: 'https://odoo.test',
      odooDb: 'test_db',
      serviceUser: 'kiosko@test.com',
      servicePassword: 'secret',
      printerUrl: 'http://127.0.0.1/ServWebImpresion/api/',
      printerModel: 'm',
      adminPin: '1234',
      configToken: 'TOKEN'
    })

    expect(useConfigStore.getState().accentColor).toBe('#3b82f6')
  })

  it('reauthenticate parses x_accent_color, normalizes it, and stores it', async () => {
    vi.mocked(pingStation).mockResolvedValue({
      id: 42, name: 'Caja 1', code: 'C1', branchId: 7, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })
    vi.mocked(odooEnv.callMethod).mockResolvedValue({ x_accent_color: '#3B82F6' })

    await useConfigStore.getState().reauthenticate()

    expect(useConfigStore.getState().accentColor).toBe('#3b82f6')
  })

  it('reauthenticate falls back to DEFAULT_ACCENT without throwing when the key is malformed or absent', async () => {
    vi.mocked(pingStation).mockResolvedValue({
      id: 42, name: 'Caja 1', code: 'C1', branchId: 7, companyId: 1,
      activeSessionId: false, operateWithoutPrinter: false, allowLocalDB: false
    })
    vi.mocked(odooEnv.callMethod).mockResolvedValue({ x_accent_color: 'not-a-color' })

    await expect(useConfigStore.getState().reauthenticate()).resolves.toBeUndefined()
    expect(useConfigStore.getState().accentColor).toBe(DEFAULT_ACCENT)

    vi.mocked(odooEnv.callMethod).mockResolvedValue({})
    await expect(useConfigStore.getState().reauthenticate()).resolves.toBeUndefined()
    expect(useConfigStore.getState().accentColor).toBe(DEFAULT_ACCENT)
  })

  it('clearConfig resets accentColor to DEFAULT_ACCENT', () => {
    useConfigStore.setState({ accentColor: '#3b82f6' })
    useConfigStore.getState().clearConfig()
    expect(useConfigStore.getState().accentColor).toBe(DEFAULT_ACCENT)
  })
})
