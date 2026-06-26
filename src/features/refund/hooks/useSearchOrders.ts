import { useQuery } from '@tanstack/react-query'
import { searchOrders } from '@/shared/lib/odooRepository'

export function useSearchOrders(pattern: string) {
  return useQuery({
    queryKey: ['orders', pattern],
    enabled: pattern.trim().length === 0 || pattern.trim().length >= 2,
    queryFn: () => searchOrders(pattern)
  })
}
