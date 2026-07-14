import { AppOrderSummary } from '@/features/cart/components/AppOrderSummary'
import type { KioskOrder } from '@/shared/types/types'
import { OrderSearchList } from './OrderSearchList'
import styles from '../pages/AdvancedMenu.module.css'

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
  onRequestReturn
}: Props) {
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
            <div className="card">
              <AppOrderSummary order={order} />
            </div>
          )}
          <label className={styles.reasonLabel}>Motivo de devolución
            <select
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            >
              <option value="">Seleccione un motivo</option>
              <option value="averia">Por avería</option>
              <option value="producto">Por producto</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button type="button" className="btn btn-danger" onClick={onRequestReturn}>
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
