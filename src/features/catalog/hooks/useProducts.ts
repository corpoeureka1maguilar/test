import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { getProducts, replaceProducts } from '@/shared/lib/offlineCache'
import type { KioskProduct } from '@/shared/types/types'

const POLL_INTERVAL_MS = 10 * 60 * 1000

// Write-through/read-through: un fetch exitoso reemplaza el caché offline; un
// fetch fallido (red/timeout/5xx) sirve el último caché bueno conocido en vez
// de romper la pantalla del catálogo (spec: offline-catalog-cache).
// El write-through es fire-and-forget (igual que persistPrinterData en
// saleMachine): la UI no debe esperar a IndexedDB para pintar el catálogo, y
// un fallo al escribir el caché no debe convertir un fetch exitoso en error.
async function fetchProductsWithOfflineFallback(fixedProductIds: number[], pricelistId: number): Promise<KioskProduct[]> {
  try {
    const fresh = await fetchProducts(fixedProductIds, pricelistId)
    replaceProducts(fresh).catch((err) => console.error('[useProducts] Error escribiendo caché offline:', err))
    return fresh
  } catch (err) {
    const cached = await getProducts<KioskProduct>()
    if (cached.length) return cached
    throw err
  }
}

export function useProducts() {
  const fixedProductIds = useConfigStore((s) => s.fixedProductIds)
  const pricelistId = useConfigStore((s) => s.pricelistId)
  return useQuery({
    queryKey: ['products', fixedProductIds, pricelistId],
    queryFn: () => fetchProductsWithOfflineFallback(fixedProductIds, pricelistId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
  })
}
