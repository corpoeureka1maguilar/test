import type { GiftCard } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import styles from '../pages/PaymentForm.module.css'

interface GiftCardPaymentViewProps {
  total: number
  globalRate: number
  orderTotalUSD: number
  foundCard: GiftCard | null
  hasSufficientBalance: boolean
  giftCardCode: string
  onGiftCardCodeChange: (value: string) => void
  searchingCard: boolean
  cardError: string | null
  showKeyboard: boolean
  onShowKeyboardChange: (visible: boolean) => void
  onSearchCard: () => void
  onGiftCardSubmit: (e: React.FormEvent) => void
  onUseAnotherCard: () => void
  onBack: () => void
}

export function GiftCardPaymentView({
  total,
  globalRate,
  orderTotalUSD,
  foundCard,
  hasSufficientBalance,
  giftCardCode,
  onGiftCardCodeChange,
  searchingCard,
  cardError,
  showKeyboard,
  onShowKeyboardChange,
  onSearchCard,
  onGiftCardSubmit,
  onUseAnotherCard,
  onBack
}: GiftCardPaymentViewProps) {
  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>Pago con Tarjeta de Regalo</h1>

      <div className={`${styles.summaryContainer} ${styles.summaryContainerCentered}`}>
        <div className={styles.summaryCard}>
          <div className={styles.amountRow}>
            <span>Total de la compra</span>
            <strong>
              <span className={styles.amountUsd}>{formatUSD(orderTotalUSD)}</span>
              <span className={styles.amountSecondary}>{formatBs(total)}</span>
            </strong>
          </div>

          {foundCard && (
            <>
              <hr className={styles.divider} />
              <div className={styles.amountRow}>
                <span>Saldo de la tarjeta</span>
                <strong className={styles.cardBalance}>
                  {formatUSD(foundCard.balance)}
                  <span className={styles.amountSecondary}>{formatBs(foundCard.balance * globalRate)}</span>
                </strong>
              </div>
              <div className={styles.amountRow}>
                <span>Monto a consumir</span>
                <strong className={styles.amountToConsume}>
                  {formatUSD(orderTotalUSD)}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>

      {!foundCard ? (
        <div className={styles.formContainer}>
          <div className={styles.label}>
            <span>Código de la tarjeta</span>
            <div className={styles.searchRow}>
              <input
                type="text"
                value={giftCardCode}
                onChange={e => onGiftCardCodeChange(e.target.value)}
                placeholder="CARDXXXXXXXXXX"
                className={styles.giftCardInput}
                disabled={searchingCard}
                onFocus={() => onShowKeyboardChange(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSearchCard()
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={onSearchCard}
                className={`btn btn-accent ${styles.searchButton}`}
                disabled={searchingCard}
              >
                {searchingCard ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
          {cardError && <p className={styles.errorText}>{cardError}</p>}

          {showKeyboard && (
            <div className={styles.inlineKeyboardContainer}>
              <AppVirtualKeyboard
                value={giftCardCode}
                onChange={onGiftCardCodeChange}
                onClose={() => onShowKeyboardChange(false)}
                onEnter={() => {
                  onSearchCard()
                  onShowKeyboardChange(false)
                }}
              />
            </div>
          )}

          <div className={`${styles.actions} ${styles.actionsSpaced}`}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Volver</button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={onGiftCardSubmit}>
          {!hasSufficientBalance && (
            <div className={styles.noRateWarning}>
              El saldo de tu tarjeta de regalo ({formatUSD(foundCard.balance)}) es menor que el total a pagar ({formatUSD(orderTotalUSD)}).
            </div>
          )}

          {hasSufficientBalance && (
            <p className={styles.successText}>
              ✓ Tarjeta lista para usar. Se debitarán {formatUSD(orderTotalUSD)} de tu saldo.
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={!hasSufficientBalance}
            >
              Confirmar consumo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onUseAnotherCard}
            >
              Usar otra tarjeta
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
