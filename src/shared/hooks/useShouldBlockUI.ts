import { useConfigStore } from '@/shared/stores/config'
import { useOfflineQueueStore } from '@/shared/stores/offlineQueue'
import { MAX_QUEUE_SIZE } from '@/shared/lib/orderQueue'

// Selector derivado (design ADR-4): el kiosko solo debe bloquear la UI cuando
// está offline Y la cola local ya está llena (no puede encolar una venta más).
// Deliberadamente NO reutiliza `isOffline` a secas: ese flag lo pisa
// cualquier RPC que falle (p. ej. fetchAdvertisements) y no implica que el
// kiosko no pueda seguir vendiendo offline mientras haya cupo en la cola.
// Cada sub-selector devuelve un primitivo -> sin re-renders por referencia
// (vercel-react rule: selector-based subscriptions).
export function useShouldBlockUI(): boolean {
  const isConfigured = useConfigStore((s) => s.isConfigured)
  const isOffline = useConfigStore((s) => s.isOffline)
  const count = useOfflineQueueStore((s) => s.count)

  return isConfigured && isOffline && count >= MAX_QUEUE_SIZE
}
