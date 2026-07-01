import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { odooEnv } from '@/shared/lib/odooEnv'
import { linkStation, pingStation, fetchCompanyLogo, fetchBranchState, fetchBranchFixedProducts } from '@/shared/lib/odooRepository'

// En dev: proxy de Vite en la misma origin
// En prod con app central: proxy local en localhost:9191
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE ?? ''

async function setProxyTarget(url: string) {
  try {
    await fetch(`${PROXY_BASE}/__odoo-proxy-target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: url })
    })
  } catch {
    // ignorar si el proxy no está corriendo
  }
}

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

interface ConfigState {
  odooUrl: string
  odooDb: string
  serviceUser: string
  servicePassword: string
  printerUrl: string
  printerModel: string
  adminPinHash: string
  stationId: number
  stationName: string
  branchState: string
  fixedProductIds: number[]
  appToken: string
  companyLogo: string
  isConfigured: boolean
  isConnectionReady: boolean
}

interface ConfigActions {
  saveConfig(data: {
    odooUrl: string
    odooDb: string
    serviceUser: string
    servicePassword: string
    printerUrl: string
    printerModel: string
    adminPin: string
    configToken?: string
  }): Promise<void>
  clearConfig(): void
  verifyPin(pin: string): Promise<boolean>
  reauthenticate(): Promise<void>
}

export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    (set, get) => ({
      odooUrl: '',
      odooDb: '',
      serviceUser: '',
      servicePassword: '',
      printerUrl: 'http://127.0.0.1/ServWebImpresion/api/',
      printerModel: '',
      adminPinHash: '',
      stationId: 0,
      stationName: '',
      branchState: '',
      fixedProductIds: [],
      appToken: '',
      companyLogo: '',
      isConfigured: false,
      isConnectionReady: false,

      async saveConfig(data) {
        const pinHash = await sha256(data.adminPin)
        const appToken = crypto.randomUUID()

        await setProxyTarget(data.odooUrl)

        odooEnv.setupConnection({
          url: data.odooUrl,
          db: data.odooDb,
          password: data.servicePassword
        })

        await odooEnv.authenticate(data.serviceUser)

        const companyLogo = await fetchCompanyLogo().catch(() => '')

        if (data.configToken) {
          const station = await linkStation(data.configToken, appToken)
          const branchState = station.branchId
            ? await fetchBranchState(station.branchId).catch(() => '')
            : ''
          const fixedProductIds = station.branchId
            ? await fetchBranchFixedProducts(station.branchId).catch(() => [])
            : []
          set({
            odooUrl: data.odooUrl,
            odooDb: data.odooDb,
            serviceUser: data.serviceUser,
            servicePassword: data.servicePassword,
            printerUrl: data.printerUrl,
            printerModel: data.printerModel,
            adminPinHash: pinHash,
            stationId: station.id,
            stationName: station.name,
            branchState,
            fixedProductIds,
            appToken,
            companyLogo,
            isConfigured: true,
            isConnectionReady: true
          })
        } else {
          const { stationId, stationName, branchState, fixedProductIds, appToken: existingToken } = get()
          set({
            odooUrl: data.odooUrl,
            odooDb: data.odooDb,
            serviceUser: data.serviceUser,
            servicePassword: data.servicePassword,
            printerUrl: data.printerUrl,
            printerModel: data.printerModel,
            adminPinHash: pinHash,
            stationId,
            stationName,
            branchState,
            fixedProductIds,
            appToken: existingToken,
            companyLogo,
            isConfigured: true,
            isConnectionReady: true
          })
        }
      },

      clearConfig() {
        odooEnv.disconnect()
        set({
          odooUrl: '',
          odooDb: '',
          serviceUser: '',
          servicePassword: '',
          printerUrl: 'http://127.0.0.1/ServWebImpresion/api/',
          printerModel: '',
          adminPinHash: '',
          stationId: 0,
          stationName: '',
          branchState: '',
          fixedProductIds: [],
          appToken: '',
          companyLogo: '',
          isConfigured: false,
          isConnectionReady: false
        })
      },

      async verifyPin(pin) {
        const hash = await sha256(pin)
        return hash === get().adminPinHash
      },

      async reauthenticate() {
        const { odooUrl, odooDb, serviceUser, servicePassword, stationId, isConfigured } = get()
        if (!isConfigured) return
        try {
          await setProxyTarget(odooUrl)
          odooEnv.setupConnection({ url: odooUrl, db: odooDb, password: servicePassword })
          await odooEnv.authenticate(serviceUser)
          const [station, companyLogo] = await Promise.all([
            pingStation(stationId),
            fetchCompanyLogo().catch(() => get().companyLogo)
          ])
          const branchState = station.branchId
            ? await fetchBranchState(station.branchId).catch(() => get().branchState)
            : get().branchState
          const fixedProductIds = station.branchId
            ? await fetchBranchFixedProducts(station.branchId).catch(() => get().fixedProductIds)
            : get().fixedProductIds
          set({ isConnectionReady: true, companyLogo, branchState, fixedProductIds })
        } catch (err) {
          set({ isConnectionReady: false })
          throw err
        }
      }
    }),
    {
      name: 'autopay-config',
      partialize: (state) => ({
        odooUrl: state.odooUrl,
        odooDb: state.odooDb,
        serviceUser: state.serviceUser,
        servicePassword: state.servicePassword,
        printerUrl: state.printerUrl,
        printerModel: state.printerModel,
        adminPinHash: state.adminPinHash,
        stationId: state.stationId,
        stationName: state.stationName,
        branchState: state.branchState,
        fixedProductIds: state.fixedProductIds,
        appToken: state.appToken,
        companyLogo: state.companyLogo,
        isConfigured: state.isConfigured
      })
    }
  )
)
