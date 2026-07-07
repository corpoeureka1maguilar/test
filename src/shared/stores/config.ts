import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { odooEnv, isMissingRecordError } from '@/shared/lib/odooEnv'
import { useUIStore } from '@/shared/stores/ui'
import { linkStation, pingStation, fetchCompanyLogo, fetchBranchState, fetchBranchFixedProducts, fetchBranchDefaultPricelist } from '@/shared/lib/odooRepository'
import { hashPin, verifyPinHash, isLegacyPinHash, randomUUID } from '@/shared/lib/cryptoUtils'
import { saveSecret, loadSecret, deleteSecret } from '@/shared/lib/secureStorage'

// La password del usuario de servicio vive cifrada (ver secureStorage), nunca
// en el JSON plano de zustand/persist
const SERVICE_PASSWORD_SECRET = 'service-password'

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
  branchId: number
  branchState: string
  fixedProductIds: number[]
  pricelistId: number
  appToken: string
  companyLogo: string
  isConfigured: boolean
  isConnectionReady: boolean
  isOffline: boolean
  useGiftCard: boolean
  giftCardProductId: number
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
  devtools(
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
      branchId: 0,
      branchState: '',
      fixedProductIds: [],
      pricelistId: 0,
      appToken: '',
      companyLogo: '',
      useGiftCard: false,
      giftCardProductId: 0,
      isConfigured: false,
      isConnectionReady: false,
      isOffline: false,

      async saveConfig(data) {
        const pinHash = hashPin(data.adminPin)
        const appToken = randomUUID()

        await setProxyTarget(data.odooUrl)

        odooEnv.setupConnection({
          url: data.odooUrl,
          db: data.odooDb,
          password: data.servicePassword
        })

        await odooEnv.authenticate(data.serviceUser)

        await saveSecret(SERVICE_PASSWORD_SECRET, data.servicePassword)

        const companyLogo = await fetchCompanyLogo().catch(() => '')

        const customConfig = await odooEnv.callMethod<Record<string, any>>('x.pos.station', 'action_get_custom_config').catch(() => ({}))
        const useGiftCard = !!customConfig.x_use_gift_card
        const giftCardProductId = Number(customConfig.x_gift_card_product || 0)

        if (data.configToken) {
          const station = await linkStation(data.configToken, appToken)
          const branchState = station.branchId
            ? await fetchBranchState().catch(() => '')
            : ''
          const fixedProductIds = station.branchId
            ? await fetchBranchFixedProducts(station.branchId).catch(() => [])
            : []
          const pricelistId = station.branchId
            ? await fetchBranchDefaultPricelist(station.branchId).catch(() => 0)
            : 0
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
            branchId: station.branchId || 0,
            branchState,
            fixedProductIds,
            pricelistId,
            appToken,
            companyLogo,
            useGiftCard,
            giftCardProductId,
            isConfigured: true,
            isConnectionReady: true,
            isOffline: false
          })
        } else {
          const { stationId, stationName, branchId, branchState, fixedProductIds, pricelistId, appToken: existingToken } = get()
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
            branchId,
            branchState,
            fixedProductIds,
            pricelistId,
            appToken: existingToken,
            companyLogo,
            useGiftCard,
            giftCardProductId,
            isConfigured: true,
            isConnectionReady: true,
            isOffline: false
          })
        }
      },

      clearConfig() {
        odooEnv.disconnect()
        deleteSecret(SERVICE_PASSWORD_SECRET)
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
          branchId: 0,
          branchState: '',
          fixedProductIds: [],
          pricelistId: 0,
          appToken: '',
          companyLogo: '',
          isConfigured: false,
          isConnectionReady: false,
          isOffline: false
        })
      },

      async verifyPin(pin) {
        const stored = get().adminPinHash
        const ok = verifyPinHash(pin, stored)
        // Upgrade transparente: configs viejas guardaban SHA-256 plano sin salt
        if (ok && isLegacyPinHash(stored)) {
          set({ adminPinHash: hashPin(pin) })
        }
        return ok
      },

      async reauthenticate() {
        const { odooUrl, odooDb, serviceUser, stationId, isConfigured } = get()
        if (!isConfigured) return

        // La password vive cifrada fuera del estado persistido; tras un reload
        // hay que recuperarla. Configs viejas la tenían en texto plano dentro
        // del JSON de persist: se migra al almacenamiento cifrado y el próximo
        // write de persist la elimina del JSON (ya no está en partialize).
        let servicePassword = get().servicePassword
        if (!servicePassword) {
          servicePassword = await loadSecret(SERVICE_PASSWORD_SECRET)
          if (servicePassword) set({ servicePassword })
        } else if (!(await loadSecret(SERVICE_PASSWORD_SECRET))) {
          await saveSecret(SERVICE_PASSWORD_SECRET, servicePassword)
        }

        try {
          await setProxyTarget(odooUrl)
          odooEnv.setupConnection({ url: odooUrl, db: odooDb, password: servicePassword })
          await odooEnv.authenticate(serviceUser)
          const [station, companyLogo, customConfig] = await Promise.all([
            pingStation(stationId),
            fetchCompanyLogo().catch(() => get().companyLogo),
            odooEnv.callMethod<Record<string, any>>('x.pos.station', 'action_get_custom_config').catch(() => ({}))
          ])
          const useGiftCard = !!customConfig.x_use_gift_card
          const giftCardProductId = Number(customConfig.x_gift_card_product || 0)
          const branchState = station.branchId
            ? await fetchBranchState().catch(() => get().branchState)
            : get().branchState
          const fixedProductIds = station.branchId
            ? await fetchBranchFixedProducts(station.branchId).catch(() => get().fixedProductIds)
            : get().fixedProductIds
          const pricelistId = station.branchId
            ? await fetchBranchDefaultPricelist(station.branchId).catch(() => get().pricelistId)
            : get().pricelistId
          set({ isConnectionReady: true, isOffline: false, companyLogo, branchId: station.branchId || get().branchId, branchState, fixedProductIds, pricelistId, useGiftCard, giftCardProductId })
        } catch (err) {
          // La estación fue borrada en Odoo (p. ej. la duplicaron y eliminaron
          // la original): error PERMANENTE, reintentar deja la caja bloqueada
          // para siempre. Se desvincula la estación para que el kiosko caiga a
          // /setup (el token vuelve a ser obligatorio) conservando credenciales
          // e impresora, y se corta el loop de reintentos (no se relanza).
          if (isMissingRecordError(err)) {
            console.error('[config] La estación ya no existe en Odoo; se requiere re-vinculación:', err)
            set({ isConfigured: false, isConnectionReady: false, isOffline: false, stationId: 0, stationName: '' })
            useUIStore.getState().pushToast(
              'error',
              'La estación de este kiosko fue eliminada en Odoo. Vincúlela nuevamente con un token de configuración.',
              true
            )
            return
          }
          set({ isConnectionReady: false, isOffline: true })
          throw err
        }
      }
    }),
    {
      name: 'autopay-config',
      // servicePassword NO se persiste acá: va cifrada vía secureStorage
      partialize: (state) => ({
        odooUrl: state.odooUrl,
        odooDb: state.odooDb,
        serviceUser: state.serviceUser,
        printerUrl: state.printerUrl,
        printerModel: state.printerModel,
        adminPinHash: state.adminPinHash,
        stationId: state.stationId,
        stationName: state.stationName,
        branchId: state.branchId,
        branchState: state.branchState,
        fixedProductIds: state.fixedProductIds,
        pricelistId: state.pricelistId,
        appToken: state.appToken,
        companyLogo: state.companyLogo,
        useGiftCard: state.useGiftCard,
        giftCardProductId: state.giftCardProductId,
        isConfigured: state.isConfigured
      })
    }
    ),
    { name: 'config' }
  )
)
