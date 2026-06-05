import { useQuery } from '@tanstack/react-query'
import { fetchOrder } from '@/shared/lib/odooRepository'

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: ['order', id],
    enabled: id !== null,
    queryFn: () => fetchOrder(id!)
  })
}
