import { useEffect } from 'react'
import { fetchExchangeRate } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

// Esta pantalla puede abrirse directo (sin haber pasado por el catálogo de
// productos), que es donde normalmente se obtiene la tasa. Refrescarla acá
// asegura que las métricas y órdenes siempre puedan mostrar el equivalente en $.
// Se espera a isConnectionReady para no pedirla antes de que reauthenticate()
// termine, y en error se conserva la última tasa buena conocida (no se pisa con 1).
export function useExchangeRateSync() {
  const rate = useExchangeRateStore((s) => s.rate)
  const setRate = useExchangeRateStore((s) => s.setRate)
  const isConnectionReady = useConfigStore((s) => s.isConnectionReady)

  useEffect(() => {
    if (!isConnectionReady) return
    fetchExchangeRate().then(setRate).catch((err) => {
      console.error('Error fetching exchange rate for /advanced:', err)
    })
  }, [isConnectionReady, setRate])

  return rate
}
