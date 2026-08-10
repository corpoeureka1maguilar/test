import { useEffect, useMemo, useState } from 'react'
import type { KioskOrder } from '@/shared/types/types'

export interface ReturnLineSelectionEntry {
  checked: boolean
  qty: number
}

export interface SelectedReturnLine {
  id: number
  product: number
  quantity: number
  priceUnit: number
  taxRate?: number | undefined
  name: string
}

// Cuánto de la línea todavía se puede devolver: lo ya devuelto (x_return_quantity)
// no cuenta de nuevo, si no el kiosco deja devolver la misma unidad más de una vez
function availableQty(line: { productUomQty: number; returnedQty?: number | undefined }): number {
  return Math.max(line.productUomQty - (line.returnedQty ?? 0), 0)
}

// Por defecto se marcan todas las líneas con lo que les queda disponible: el
// comportamiento sin tocar nada sigue siendo "devolver todo lo pendiente",
// igual que antes, pero sin reofertar lo ya devuelto. Las líneas sin nada
// disponible quedan desmarcadas y en 0
function buildFullSelection(order: KioskOrder | null): Record<number, ReturnLineSelectionEntry> {
  const lines = order?.lines ?? []
  const selection: Record<number, ReturnLineSelectionEntry> = {}
  for (const line of lines) {
    const qty = availableQty(line)
    selection[line.id] = { checked: qty > 0, qty }
  }
  return selection
}

export function useReturnLineSelection(order: KioskOrder | null) {
  const [selection, setSelection] = useState<Record<number, ReturnLineSelectionEntry>>(() => buildFullSelection(order))

  // order.lines llega async (useOrder termina de resolver después de
  // setSelectedOrder), así que hay que resetear cuando cambian los ids de
  // línea reales, no solo cuando cambia order?.id
  const lineIdsKey = (order?.lines ?? []).map((l) => l.id).join(',')
  useEffect(() => {
    setSelection(buildFullSelection(order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIdsKey])

  const toggleLine = (lineId: number) => {
    setSelection((prev) => {
      const entry = prev[lineId]
      if (!entry) return prev
      return { ...prev, [lineId]: { ...entry, checked: !entry.checked } }
    })
  }

  const setQty = (lineId: number, qty: number) => {
    const line = order?.lines?.find((l) => l.id === lineId)
    if (!line) return
    const clamped = Math.min(Math.max(qty, 1), availableQty(line))
    setSelection((prev) => {
      const entry = prev[lineId]
      if (!entry) return prev
      return { ...prev, [lineId]: { ...entry, qty: clamped } }
    })
  }

  const selectAll = () => setSelection(buildFullSelection(order))

  const clearAll = () => {
    setSelection((prev) => {
      const next: Record<number, ReturnLineSelectionEntry> = {}
      for (const [id, entry] of Object.entries(prev)) {
        next[Number(id)] = { ...entry, checked: false }
      }
      return next
    })
  }

  const selectedLines = useMemo<SelectedReturnLine[]>(() => {
    const lines = order?.lines ?? []
    return lines
      .filter((line) => selection[line.id]?.checked && (selection[line.id]?.qty ?? 0) > 0)
      .map((line) => ({
        id: line.id,
        product: line.productId[0],
        quantity: selection[line.id]!.qty,
        priceUnit: line.priceUnit,
        taxRate: line.taxRate,
        name: line.productId[1]
      }))
  }, [order, selection])

  const isValid = selectedLines.length > 0

  return { selection, toggleLine, setQty, selectAll, clearAll, selectedLines, isValid }
}
