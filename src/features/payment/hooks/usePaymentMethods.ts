import { useQuery } from '@tanstack/react-query'
import { fetchPaymentMethods } from '@/shared/lib/odooRepository'

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    staleTime: 5 * 60 * 1000
  })
}
