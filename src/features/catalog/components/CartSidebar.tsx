import type { CartItem, KioskProduct } from '@/shared/types/types'
import type { CartTaxBreakdownItem } from '@/features/cart/stores/cart'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { ShoppingCart } from '@phosphor-icons/react'
import { CartItemRow } from './CartItemRow'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  items: CartItem[]
  count: number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  lastScannedProduct: KioskProduct | null
  setLastScannedProduct: (product: KioskProduct | null) => void
  subtotal: number
  taxBreakdown: CartTaxBreakdownItem[]
  total: number
  rate: number
  isBouncing: boolean
  onCancel: () => void
  onCheckout: () => void
}

/** Carrito lateral integrado: listado de items, desglose de totales y acciones */
export function CartSidebar({
  items,
  count,
  setQty,
  removeItem,
  lastScannedProduct,
  setLastScannedProduct,
  subtotal,
  taxBreakdown,
  total,
  rate,
  isBouncing,
  onCancel,
  onCheckout
}: Props) {
  return (
    <div className={styles.cartSidebar}>
      <div className={styles.cartHeader}>
        <h2 className={styles.cartTitle}>Tu Compra</h2>
        <span className={styles.cartCountBadge}>{count} {count === 1 ? 'elemento' : 'elementos'}</span>
      </div>

      {/* Listado con Scroll de ítems */}
      <div className={styles.cartList}>
        {items.map(item => (
          <CartItemRow
            key={item.productId}
            item={item}
            onDecrement={() => {
              if (item.qty > 1) {
                setQty(item.productId, item.qty - 1)
              }
            }}
            onIncrement={() => setQty(item.productId, item.qty + 1)}
            onRemove={() => {
              removeItem(item.productId)
              if (lastScannedProduct?.id === item.productId) {
                setLastScannedProduct(null)
              }
            }}
          />
        ))}

        {items.length === 0 && (
          <div className={styles.cartEmpty}>
            <ShoppingCart size={48} weight="light" className={styles.cartEmptyIcon} />
            <p>Tu carrito está vacío</p>
            <span className={styles.cartEmptyHint}>
              Escanéa códigos para agregar
            </span>
          </div>
        )}
      </div>

      {/* Desglose de totales */}
      <div className={styles.totalsSection}>
        <div className={styles.totalRow}>
          <span>Subtotal</span>
          <span>{formatBs(subtotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(subtotal / rate)}</span>}</span>
        </div>
        {taxBreakdown.map((tax) => (
          <div key={tax.rate} className={styles.totalRow}>
            <span>{tax.label}</span>
            <span>{formatBs(tax.amount)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(tax.amount / rate)}</span>}</span>
          </div>
        ))}
        <div className={styles.totalRowBig}>
          <span>Total</span>
          <span className={styles.totalAmount}>{formatBs(total)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}</span>
        </div>
      </div>

      {/* Acciones principales */}
      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-secondary cancelBtn"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`btn btn-accent checkoutBtn ${isBouncing ? 'animate-pulse' : ''}`}
          onClick={onCheckout}
          disabled={count === 0}
        >
          PAGAR AHORA
        </button>
      </div>
    </div>
  )
}
