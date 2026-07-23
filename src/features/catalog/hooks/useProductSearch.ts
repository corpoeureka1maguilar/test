import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { searchProducts } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'

/**
 * Búsqueda de productos contra el backend (catálogo completo) cuando hay
 * conexión, con fallback al filtro local sobre el caché offline.
 *
 * Por qué online-first: la búsqueda local solo ve los ~200 productos
 * precargados por useProducts; un producto fuera de ese tope existe en Odoo
 * pero jamás aparecería. Estando online preguntamos al backend por el patrón
 * completo (nombre/código/barcode). Offline —o si el RPC falla— el caller usa
 * el filtro local para no romper la venta sin conexión.
 *
 * `keepPreviousData` evita el parpadeo del grid entre teclas mientras llega la
 * respuesta del backend.
 */
export function useProductSearch(debouncedSearch: string) {
  const isOffline = useConfigStore((s) => s.isOffline)
  const pricelistId = useConfigStore((s) => s.pricelistId)
  const query = debouncedSearch.trim()

  // Solo consultamos al backend con conexión y un patrón no vacío
  const online = !isOffline && query.length > 0

  const result = useQuery({
    queryKey: ['product-search', query, pricelistId],
    queryFn: () => searchProducts(query, pricelistId),
    enabled: online,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData
  })

  return {
    // true = estamos en modo búsqueda online (el caller ignora el filtro local)
    online,
    // KioskProduct[] cuando el backend respondió; undefined mientras no hay dato
    results: online ? result.data : undefined,
    isSearching: online && result.isFetching && result.data === undefined,
    // el RPC falló: el caller debe caer al filtro local (fallback offline)
    searchFailed: online && result.isError
  }
}
