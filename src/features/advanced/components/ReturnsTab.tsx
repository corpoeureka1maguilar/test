import { AppOrderSummary } from '@/features/cart/components/AppOrderSummary'
import type { KioskOrder } from '@/shared/types/types'
import { OrderSearchList } from './OrderSearchList'

interface SelectionEntry {
  checked: boolean
  qty: number
}

interface Props {
  selectedOrder: KioskOrder | null
  order: KioskOrder | null
  pattern: string
  onPatternChange: (value: string) => void
  isFetching: boolean
  results: KioskOrder[]
  rate: number
  onSelectOrder: (order: KioskOrder) => void
  onClearSelection: () => void
  reason: string
  onReasonChange: (value: string) => void
  onRequestReturn: () => void
  selection: Record<number, SelectionEntry>
  onToggleLine: (lineId: number) => void
  onQtyChange: (lineId: number, qty: number) => void
  onSelectAll: () => void
  onClearAll: () => void
  isValid: boolean
}

export function ReturnsTab({
  selectedOrder,
  order,
  pattern,
  onPatternChange,
  isFetching,
  results,
  rate,
  onSelectOrder,
  onClearSelection,
  reason,
  onReasonChange,
  onRequestReturn,
  selection,
  onToggleLine,
  onQtyChange,
  onSelectAll,
  onClearAll,
  isValid
}: Props) {
  const totalOverride = order?.lines?.reduce((sum, line) => {
    const entry = selection[line.id]
    return entry?.checked ? sum + entry.qty * line.priceUnit : sum
  }, 0) ?? 0

  return (
    <>
      {!selectedOrder ? (
        <OrderSearchList
          pattern={pattern}
          onPatternChange={onPatternChange}
          placeholder="Buscá la orden a devolver"
          isFetching={isFetching}
          results={results}
          rate={rate}
          onSelectOrder={onSelectOrder}
        />
      ) : (
        <>
          {order && (
            <div className="card max-w-[1200px]">
              <div className="flex justify-end gap-3 mb-3">
                <button type="button" className="btn btn-secondary" onClick={onSelectAll}>Seleccionar todo</button>
                <button type="button" className="btn btn-secondary" onClick={onClearAll}>Ninguno</button>
              </div>
              <AppOrderSummary
                order={order}
                selectable
                selection={selection}
                onToggleLine={onToggleLine}
                onQtyChange={onQtyChange}
                totalOverride={totalOverride}
              />
            </div>
          )}
          <label className="flex flex-col gap-3 text-[1.1rem] font-bold text-text-muted uppercase tracking-[0.05em] mx-auto my-8 w-full max-w-[520px]">Motivo de devolución
            <select
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            >
              <option value="">Seleccione un motivo</option>
              <option value="averia">Por avería</option>
              <option value="producto">Por producto</option>
            </select>
          </label>
          <div className="flex flex-col items-center gap-4 w-full">
            <button type="button" className="btn btn-primary" onClick={onRequestReturn} disabled={!isValid}>
              Confirmar devolución
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClearSelection}>
              Buscar otra orden
            </button>
          </div>
        </>
      )}
    </>
  )
}
