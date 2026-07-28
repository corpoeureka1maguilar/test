import type { GiftCard } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'

interface GiftCardPaymentViewProps {
  total: number
  globalRate: number
  orderTotalUSD: number
  foundCard: GiftCard | null
  hasSufficientBalance: boolean
  consumedAmountUSD: number
  consumedAmountInput?: string
  onConsumedAmountChange?: (value: string) => void
  isValidConsumedAmount?: boolean
  remainingBs: number
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
  consumedAmountUSD,
  consumedAmountInput,
  onConsumedAmountChange,
  isValidConsumedAmount = true,
  remainingBs,
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
  // Saldo agotado/insuficiente-a-cero (Scenario 3, sin cambios): bloqueo duro.
  // Pago parcial (Scenario 2): 0 < balance < total — ya NO bloquea, muestra
  // el remanente y habilita continuar a elegir el segundo método.
  const isZeroBalance = !!foundCard && foundCard.balance <= 0
  const isPartial = !!foundCard && !hasSufficientBalance && !isZeroBalance
  const maxConsumableUSD = foundCard ? Math.min(foundCard.balance, orderTotalUSD) : 0

  return (
    <div className="kiosk-container">
      <h1 className="mb-6 text-center font-extrabold tracking-[-0.05em]">Pago con Tarjeta de Regalo</h1>

      <div className="mx-auto mb-12 w-full max-w-[600px] animate-scaleIn">
        <div className="glass-card flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
            <span>Total de la compra</span>
            <strong className="flex flex-col items-end font-extrabold text-[1.6rem] text-text">
              {formatBs(total)}
              <span className="mt-[0.15em] block text-[0.8em] font-semibold tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(orderTotalUSD)}</span>
            </strong>
          </div>

          {foundCard && (
            <>
              <hr className="my-4 border-0 border-t border-surface-border" />
              <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
                <span>Saldo de la tarjeta</span>
                <strong className="flex flex-col items-end !font-extrabold text-[1.6rem] !text-[#22c55e]">
                  {formatUSD(foundCard.balance)}
                  <span className="mt-[0.15em] block text-[0.8em] font-semibold text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(foundCard.balance * globalRate)}</span>
                </strong>
              </div>
              <div className="flex items-center justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
                <span>Saldo a consumir ($)</span>
                {onConsumedAmountChange ? (
                  <input
                    type="number"
                    step="0.0001"
                    min={0.0001}
                    max={maxConsumableUSD}
                    value={consumedAmountInput ?? String(consumedAmountUSD)}
                    onChange={e => onConsumedAmountChange(e.target.value)}
                    className="!w-auto !flex-1 font-bold uppercase"
                    style={{ maxWidth: '160px', textAlign: 'right', fontSize: '1.4rem', padding: '0.4rem 0.8rem' }}
                    disabled={isZeroBalance}
                    aria-label="Saldo a consumir"
                  />
                ) : (
                  <strong className="!font-extrabold text-[1.6rem] !text-accent">
                    {formatUSD(consumedAmountUSD)}
                  </strong>
                )}
              </div>
              {isPartial && (
                <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
                  <span>Monto restante</span>
                  <strong className="flex flex-col items-end font-extrabold text-[1.6rem] text-text">
                    {formatBs(remainingBs)}
                    <span className="mt-[0.15em] block text-[0.8em] font-semibold tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(remainingBs / globalRate)}</span>
                  </strong>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!foundCard ? (
        <div className="mx-auto w-full max-w-[600px]">
          <div className="label-premium">
            <span>Código de la tarjeta</span>
            <div className="mt-4 flex w-full items-center gap-6">
              <input
                type="text"
                value={giftCardCode}
                onChange={e => onGiftCardCodeChange(e.target.value)}
                placeholder="CARDXXXXXXXXXX"
                className="!w-auto !flex-1 font-bold uppercase"
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
                className="btn btn-accent !h-[var(--kiosk-input-height)] !w-[180px] !shrink-0 !px-6 !text-[1.25rem] !shadow-[0_8px_20px_-8px_var(--color-accent-glow)]"
                disabled={searchingCard}
              >
                {searchingCard ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
          {cardError && <p className="mt-4 text-center text-[1.1rem] font-semibold text-danger">{cardError}</p>}

          {/* El teclado se embebe inline (no como overlay fijo). Se lo apunta
              por data-attribute: los `class*="wrapper"`/`class*="key"` de antes
              dependían de los nombres que generaba CSS Modules y dejaron de
              existir al migrar AppVirtualKeyboard a Tailwind. */}
          {showKeyboard && (
            <div className="mx-auto mt-6 w-full max-w-[600px] [&_[data-virtual-keyboard]]:!static [&_[data-virtual-keyboard]]:!inset-auto [&_[data-virtual-keyboard]]:!animate-none [&_[data-virtual-keyboard]]:!rounded-[20px] [&_[data-virtual-keyboard]]:!border [&_[data-virtual-keyboard]]:!border-surface-border [&_[data-virtual-keyboard]]:!bg-white/95 [&_[data-virtual-keyboard]]:!p-4 [&_[data-virtual-keyboard]]:!shadow-lg [&_[data-virtual-keyboard]]:![backdrop-filter:none] [&_[data-virtual-keyboard]]:!border-t-0 [&_[data-key]]:!text-[#1e293b]">
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

          <div className="mt-8 flex w-full flex-col items-center gap-4">
            <button type="button" className="btn btn-secondary" onClick={onBack}>Volver</button>
          </div>
        </div>
      ) : (
        <form className="mx-auto flex w-full max-w-[600px] flex-col gap-6" onSubmit={onGiftCardSubmit}>
          {isZeroBalance && (
            <div className="rounded-xl border border-[color-mix(in_srgb,#e53e3e_40%,transparent)] bg-[color-mix(in_srgb,#e53e3e_12%,transparent)] p-4 px-5 text-center text-[1.2rem] font-semibold text-[#e53e3e]">
              El saldo de tu tarjeta de regalo ({formatUSD(foundCard.balance)}) es menor que el total a pagar ({formatUSD(orderTotalUSD)}).
            </div>
          )}

          {hasSufficientBalance && (
            <p className="mt-4 text-center text-[1.25rem] font-bold text-[#22c55e]">
              ✓ Tarjeta lista para usar. Se debitarán {formatUSD(consumedAmountUSD)} de tu saldo.
            </p>
          )}

          {isPartial && (
            <p className="mt-4 text-center text-[1.25rem] font-bold text-[#22c55e]">
              ✓ Se consumirá {formatUSD(consumedAmountUSD)} del saldo de la tarjeta. Deberás elegir un segundo método de pago para cubrir el monto restante.
            </p>
          )}

          <div className="mt-6 flex w-full flex-col items-center gap-4">
            <button
              type="submit"
              className="btn btn-accent"
              disabled={isZeroBalance || !isValidConsumedAmount}
            >
              {isPartial ? 'Continuar a elegir método' : 'Confirmar consumo'}
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
