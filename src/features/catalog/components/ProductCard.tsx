import type { KioskProduct } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  product: KioskProduct
  qty: number
  onAdd: (product: KioskProduct) => void
  onDecrement: () => void
  onIncrement: () => void
}

/** Card individual de producto en la grilla de búsqueda manual */
export function ProductCard({ product, qty, onAdd, onDecrement, onIncrement }: Props) {
  return (
    <div
      className={`${styles.card} ${qty > 0 ? 'animate-pop' : ''}`}
      onClick={() => {
        onAdd(product);
      }}
    >
      <div>
        {product.defaultCode && <span className={styles.code}>{product.defaultCode}</span>}
        <h4 className={styles.name}>
           {product.name}
           {product.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
        </h4>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <span className={styles.price}>{formatBs(product.price)}</span>
        <span className={styles.amountUsd}>{formatUSD(product.priceUsd)}</span>
        {qty === 0 ? (
          <button
            type="button"
            className={`btn btn-primary ${styles.addBtn}`}
            onClick={() => onAdd(product)}
          >
            + Agregar
          </button>
        ) : (
          <div className={styles.qtyControl}>
            <button
              type="button"
              onClick={onDecrement}
            >
              −
            </button>
            <span>{qty}</span>
            <button type="button" onClick={onIncrement}>+</button>
          </div>
        )}
      </div>
    </div>
  )
}
