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

function AppInit() {
  const reauthenticate = useConfigStore((s) => s.reauthenticate)
  const isConfigured = useConfigStore((s) => s.isConfigured)
  
  useEffect(() => {
    if (!isConfigured) return
    reauthenticate().catch(console.error)
    const interval = setInterval(() => reauthenticate().catch(console.error), 30 * 60 * 1000)
    return () => clearInterval(interval)
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
