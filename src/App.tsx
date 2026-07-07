import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { SaleMachineProvider } from '@/features/payment/machines/SaleMachineContext'
import { AppToast } from '@/shared/components/AppToast'
import { AppLoading } from '@/shared/components/AppLoading'
import { useConfigStore } from '@/shared/stores/config'
import { initSyncManager } from '@/shared/lib/syncManager'
import '@/assets/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
})
// devtools 
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__:
      import('@tanstack/query-core')
        .QueryClient
  }
}

window.__TANSTACK_QUERY_CLIENT__ = queryClient
const REAUTH_INTERVAL_MS = 30 * 60 * 1000
const REAUTH_RETRY_BASE_MS = 15_000
const REAUTH_RETRY_MAX_MS = 2 * 60 * 1000

function AppInit() {
  const reauthenticate = useConfigStore((s) => s.reauthenticate)
  const isConfigured = useConfigStore((s) => s.isConfigured)

  useEffect(() => {
    if (!isConfigured) return

    let timer: number
    let cancelled = false
    let failures = 0

    // Si la reauth falla, el kiosko queda sin conexión hasta el próximo tick:
    // reintentar con backoff exponencial en vez de esperar 30 minutos
    const run = async () => {
      try {
        await reauthenticate()
        failures = 0

        // Fetch exchange rate on connection ready (e.g. reload or interval tick)
        try {
          const { fetchExchangeRate } = await import('@/shared/lib/odooRepository')
          const rate = await fetchExchangeRate()
          if (!cancelled && rate > 0) {
            const { useExchangeRateStore } = await import('@/shared/stores/exchangeRate')
            useExchangeRateStore.getState().setRate(rate)
          }
        } catch (rateErr) {
          console.error('[AppInit] Error updating exchange rate:', rateErr)
        }

        if (!cancelled) timer = window.setTimeout(run, REAUTH_INTERVAL_MS)
      } catch (err) {
        console.error('[AppInit] Reautenticación fallida:', err)
        failures++
        const delay = Math.min(REAUTH_RETRY_BASE_MS * 2 ** (failures - 1), REAUTH_RETRY_MAX_MS)
        if (!cancelled) timer = window.setTimeout(run, delay)
      }
    }

    run()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isConfigured, reauthenticate])

  return null
}

export function App() {
  // El synchronizer se inicializa una sola vez por arranque de la app, sin
  // depender de isConfigured: la recuperación de arranque (resetear items
  // 'draining' colgados) debe correr aunque el kiosko todavía no reautentique
  useEffect(() => {
    initSyncManager().catch((err) => {
      console.error('[App] Error inicializando el synchronizer offline:', err)
    })

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SaleMachineProvider>
        <AppInit />
        <RouterProvider router={router} />
        <AppToast />
        <AppLoading />
      </SaleMachineProvider>
    </QueryClientProvider>
  )
}
