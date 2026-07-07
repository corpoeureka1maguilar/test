import { useQuery } from '@tanstack/react-query'
import { fetchPaymentMethods } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { getPaymentMethods, replacePaymentMethods } from '@/shared/lib/offlineCache'
import type { KioskPaymentMethod } from '@/shared/types/types'

// Write-through/read-through igual que useProducts, con una diferencia
// deliberada (spec: offline-catalog-cache, "No payment methods ever cached"):
// si nunca hubo caché, se resuelve con lista vacía en vez de propagar el
// error — los métodos de pago son un bloqueador duro de checkout, y una
// lista vacía ya impide avanzar de `selectingMethod` sin necesitar un estado
// de error de query aparte
async function fetchPaymentMethodsWithOfflineFallback(branchId: number): Promise<KioskPaymentMethod[]> {
  try {
    const fresh = await fetchPaymentMethods(branchId)
    replacePaymentMethods(fresh).catch((err) => console.error('[usePaymentMethods] Error escribiendo caché offline:', err))
    return fresh
  } catch {
    return getPaymentMethods<KioskPaymentMethod>()
  }
}

export function usePaymentMethods() {
  const branchId = useConfigStore((s) => s.branchId)
  return useQuery({
    queryKey: ['payment-methods', branchId],
    queryFn: () => fetchPaymentMethodsWithOfflineFallback(branchId),
    staleTime: 5 * 60 * 1000
  })
}
