import { useMutation } from '@tanstack/react-query'
import { registerLoyaltyCard } from '@/shared/lib/odooRepository'

export function useRegisterLoyaltyCard() {
  return useMutation({
    mutationFn: ({ partnerId, engineCode, cardCode }: { partnerId: number; engineCode: string; cardCode: string }) =>
      registerLoyaltyCard(partnerId, engineCode, cardCode)
  })
}
