import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'

const POLL_INTERVAL_MS = 10 * 60 * 1000

export function useProducts() {
  const fixedProductIds = useConfigStore((s) => s.fixedProductIds)
  return useQuery({
    queryKey: ['products', fixedProductIds],
    queryFn: () => fetchProducts(fixedProductIds),
    staleTime: 5 * 60 * 1000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
  })
}
