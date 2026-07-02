import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { SaleMachineProvider } from '@/features/payment/machines/SaleMachineContext'
import { AppToast } from '@/shared/components/AppToast'
import { AppLoading } from '@/shared/components/AppLoading'
import { useConfigStore } from '@/shared/stores/config'
import '@/assets/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
})

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
