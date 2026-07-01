import { useQuery } from '@tanstack/react-query'
import { fetchAdvertisements } from '@/shared/lib/odooRepository'

const POLL_INTERVAL_MS = 10 * 60 * 1000

export function useAdvertisements(enabled: boolean) {
  return useQuery({
    queryKey: ['advertisements'],
    queryFn: fetchAdvertisements,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
  })
}
