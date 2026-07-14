import { BarcodeIcon, Sparkle } from '@phosphor-icons/react'
import type { KioskProduct } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  lastScannedProduct: KioskProduct | null
  getQty: (productId: number) => number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  setLastScannedProduct: (product: KioskProduct | null) => void
}

/** Zona izquierda de operación: lector de código de barras + último producto escaneado */
export function ScannerPanel({ lastScannedProduct, getQty, setQty, removeItem, setLastScannedProduct }: Props) {
  return (
    <div className={styles.scannerContainer}>
      {/* Zona del Lector de Código de Barras */}
      <div className={`${styles.scannerZone} ${lastScannedProduct ? styles.scannerZoneActive : ''}`}>
        <div className={styles.barcodeIcon}>
          <BarcodeIcon size={80} weight="thin" />
        </div>
        <div className={styles.scanInstruction}>
          Listo para escanear
        </div>
        <div className={styles.scanSubInstruction}>
          Pasa el código de barras de tu producto
        </div>
      </div>

      {/* Visualización Premium del Último Producto Escaneado */}
      {lastScannedProduct && (
        <div className={styles.lastScannedSection}>
          <div className={styles.lastScannedTitle}>
            <Sparkle size={18} weight="fill" style={{ color: 'var(--color-accent)', marginRight: '4px' }} />
            Último Producto Escaneado
          </div>
          <div className={styles.lastScannedCard}>
            <div className={styles.lastScannedHeader}>
              <div className={styles.lastScannedInfo}>
                <span className={styles.lastScannedCode}>
                  {lastScannedProduct.defaultCode || 'Sin código'}
                </span>
                <h3 className={styles.lastScannedName}>
                  {lastScannedProduct.name}
                  {lastScannedProduct.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
                </h3>
              </div>
              <div className={styles.lastScannedPrice}>
                {formatBs(lastScannedProduct.price)}
                <span className={styles.amountUsd}>{formatUSD(lastScannedProduct.priceUsd)}</span>
                <span className={styles.lastScannedUom}>
                  por {lastScannedProduct.uomName || 'unidad'}
                </span>
              </div>
            </div>

            {/* Control rápido de cantidad */}
            <div className={styles.lastScannedControls} onClick={(e) => e.stopPropagation()}>
              <span className={styles.lastScannedControlsLabel}>
                Cantidad:
              </span>
              <div className={styles.qtyControlGiant}>
                <button
                  type="button"
                  onClick={() => {
                    const qty = getQty(lastScannedProduct.id)
                    if (qty > 1) {
                      setQty(lastScannedProduct.id, qty - 1)
                    } else {
                      removeItem(lastScannedProduct.id)
                      setLastScannedProduct(null)
                    }
                  }}
                >
                  −
                </button>
                <span>{getQty(lastScannedProduct.id)}</span>
                <button
                  type="button"
                  onClick={() => setQty(lastScannedProduct.id, getQty(lastScannedProduct.id) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
