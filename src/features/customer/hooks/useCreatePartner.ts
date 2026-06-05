import { useMutation } from '@tanstack/react-query'
import { createPartner } from '@/shared/lib/odooRepository'
import type { CreatePartnerInput } from '@/shared/lib/odooRepository'

export type { CreatePartnerInput }

export function useCreatePartner() {
  return useMutation({ mutationFn: createPartner })
}
