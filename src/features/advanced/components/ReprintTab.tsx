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
  onRequestReprint: () => void
}

export function ReprintTab({
  selectedOrder,
  order,
  pattern,
  onPatternChange,
  isFetching,
  results,
  rate,
  onSelectOrder,
  onClearSelection,
  onRequestReprint
}: Props) {
  return (
    <>
      {!selectedOrder ? (
        <OrderSearchList
          pattern={pattern}
          onPatternChange={onPatternChange}
          placeholder="Buscá la orden a reimprimir"
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
              <p className={styles.info}>
                {order.printerNumber
                  ? `N° de factura fiscal: ${order.printerNumber}`
                  : 'Esta orden no tiene número fiscal registrado; se reimprimirá como copia no fiscal'}
              </p>
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" onClick={onRequestReprint}>
              Reimprimir factura
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
