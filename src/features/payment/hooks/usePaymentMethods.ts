import { useQuery } from '@tanstack/react-query'
import { fetchPaymentMethods } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'

export function usePaymentMethods() {
  const branchId = useConfigStore((s) => s.branchId)
  return useQuery({
    queryKey: ['payment-methods', branchId],
    queryFn: () => fetchPaymentMethods(branchId),
    staleTime: 5 * 60 * 1000
  })
}
