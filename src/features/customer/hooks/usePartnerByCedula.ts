import { useMutation } from '@tanstack/react-query'
import { searchPartnerByCedula } from '@/shared/lib/odooRepository'

export function usePartnerByCedula() {
  return useMutation({ mutationFn: searchPartnerByCedula })
}
