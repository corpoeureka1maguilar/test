import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { odooEnv } from '@/shared/lib/odooEnv'

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
  }): Promise<void>
  clearConfig(): void
  verifyPin(pin: string): Promise<boolean>
  reauthenticate(): Promise<void>
}

export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    (set, get) => ({
      odooUrl: import.meta.env.VITE_ODOO_URL || import.meta.env.VITE_ODOO_TARGET || '',
      odooDb: import.meta.env.VITE_ODOO_DB || '',
      serviceUser: import.meta.env.VITE_SERVICE_USER || '',
      servicePassword: import.meta.env.VITE_SERVICE_PASSWORD || '',
      printerUrl: import.meta.env.VITE_PRINTER_URL || 'http://127.0.0.1/ServWebImpresion/api/',
      printerModel: import.meta.env.VITE_PRINTER_MODEL || '',
      adminPinHash: '',
      isConfigured: !!(
        (import.meta.env.VITE_ODOO_URL || import.meta.env.VITE_ODOO_TARGET) &&
        import.meta.env.VITE_ODOO_DB &&
        import.meta.env.VITE_SERVICE_USER &&
        import.meta.env.VITE_SERVICE_PASSWORD
      ),
      isConnectionReady: false,

      async saveConfig(data) {
        const pinHash = await sha256(data.adminPin)

        await setProxyTarget(data.odooUrl)

        odooEnv.setupConnection({
          url: data.odooUrl,
          db: data.odooDb,
          password: data.servicePassword
        })

        await odooEnv.authenticate(data.serviceUser)

        set({
          odooUrl: data.odooUrl,
          odooDb: data.odooDb,
          serviceUser: data.serviceUser,
          servicePassword: data.servicePassword,
          printerUrl: data.printerUrl,
          printerModel: data.printerModel,
          adminPinHash: pinHash,
          isConfigured: true,
          isConnectionReady: true
        })
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
          isConfigured: false,
          isConnectionReady: false
        })
      },

      async verifyPin(pin) {
        const hash = await sha256(pin)
        const envPin = import.meta.env.VITE_ADMIN_PIN
        if (envPin && pin === envPin) return true
        return hash === get().adminPinHash
      },

      async reauthenticate() {
        const { odooUrl, odooDb, serviceUser, servicePassword, isConfigured } = get()
        if (!isConfigured) return
        try {
          await setProxyTarget(odooUrl)
          odooEnv.setupConnection({ url: odooUrl, db: odooDb, password: servicePassword })
          await odooEnv.authenticate(serviceUser)
          set({ isConnectionReady: true })
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
        isConfigured: state.isConfigured
      })
    }
  )
)
