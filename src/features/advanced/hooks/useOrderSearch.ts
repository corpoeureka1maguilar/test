import { useState } from 'react'
import { useSearchOrders } from '@/features/advanced/hooks/useSearchOrders'
import { useOrder } from '@/features/cart/hooks/useOrder'
import type { KioskOrder } from '@/shared/types/types'

export function useOrderSearch() {
  const [pattern, setPattern] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<KioskOrder | null>(null)

  const { data: results = [], isFetching } = useSearchOrders(pattern)
  const { data: orderDetail } = useOrder(selectedOrder?.id ?? null)

  const order = orderDetail ?? selectedOrder

  return {
    pattern,
    setPattern,
    selectedOrder,
    setSelectedOrder,
    results,
    isFetching,
    order
  }
}
