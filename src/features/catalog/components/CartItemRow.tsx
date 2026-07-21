import type { CartItem } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { Trash } from '@phosphor-icons/react'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  item: CartItem
  onDecrement: () => void
  onIncrement: () => void
  onRemove: () => void
}

/** Fila individual de un item del carrito lateral */
export function CartItemRow({ item, onDecrement, onIncrement, onRemove }: Props) {
  return (
    <div className={styles.cartItemCard}>
      <div className={styles.cartItemInfo}>
        <div className={styles.cartItemName}>
           {item.name}
           {item.taxRate === 0 && <span className={styles.taxExemptBadge}>(E)</span>}
        </div>
        <div className={styles.cartItemMeta}>
          {item.defaultCode && <span>{item.defaultCode}</span>}
          <span>•</span>
          <span className={styles.cartItemPrice}>{formatBs(item.price)} <span className={styles.amountUsd}>{formatUSD(item.priceUsd)}</span></span>
        </div>
      </div>

      <div className={styles.cartItemActions} onClick={(e) => e.stopPropagation()}>
        <div className={styles.qtyControlMini}>
          <button
            type="button"
            onClick={onDecrement}
          >
            −
          </button>
          <span>{item.qty}</span>
          <button
            type="button"
            onClick={onIncrement}
          >
            +
          </button>
        </div>

        <span className={styles.cartItemSubtotal}>
          {formatBs(item.subtotal)}
          <span className={styles.amountUsd}>{formatUSD(item.priceUsd * item.qty)}</span>
        </span>

        <button
          type="button"
          className={styles.removeBtnMini}
          onClick={onRemove}
          title="Eliminar"
        >
          <Trash size={18} />
        </button>
      </div>
    </div>
  )
}
