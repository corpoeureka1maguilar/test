import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/PaymentForm.module.css'

interface PaymentAmountSummaryProps {
  isForeign: boolean
  hasRate: boolean
  total: number
  globalRate: number
  igtfBs: number
  igtfPercent: number
  currencySymbol: string
  igtfUSD: number | null
  totalWithIgtfBs: number
}

export function PaymentAmountSummary({
  isForeign,
  hasRate,
  total,
  globalRate,
  igtfBs,
  igtfPercent,
  currencySymbol,
  igtfUSD,
  totalWithIgtfBs
}: PaymentAmountSummaryProps) {
  return (
    <div className={styles.summaryContainer}>
      <div className={styles.summaryCard}>

        {isForeign && !hasRate && (
          <div className={styles.noRateWarning}>
            Sin tasa de cambio disponible. No se puede procesar este método de pago.
          </div>
        )}

        {isForeign ? (
          <>
            <div className={styles.amountRow}>
              <span>Subtotal</span>
              <strong>
                 {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}
                <span className={styles.amountSecondary}>{formatBs(total)}</span>

              </strong>
            </div>

            {igtfBs > 0 && (
              <div className={styles.amountRow}>
                <span>IGTF ({igtfPercent}%)</span>
                <strong>
                  {currencySymbol} {igtfUSD?.toFixed(2) ?? '—'}
                  <span className={styles.amountSecondary}>{formatBs(igtfBs)}</span>
                  {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}
                </strong>
              </div>
            )}

            <div className={`${styles.amountRow} ${styles.total}`}>
              <span>Total a pagar</span>
              <strong>

                {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}
                <span className={styles.amountSecondary}>{formatBs(totalWithIgtfBs)}</span>
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className={styles.amountRow}>
              <span>Subtotal</span>
              <strong>{formatBs(total)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}</strong>
            </div>

            {igtfBs > 0 && (
              <div className={styles.amountRow}>
                <span>IGTF ({igtfPercent}%)</span>
                <strong>{formatBs(igtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}</strong>
              </div>
            )}

            <div className={`${styles.amountRow} ${styles.total}`}>
              <span>Total a pagar</span>
              <strong>{formatBs(totalWithIgtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
