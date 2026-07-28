import { useNavigate } from 'react-router-dom'
import { CheckCircle, Gift } from '@phosphor-icons/react'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePaymentMethods } from '@/features/payment/hooks/usePaymentMethods'
import { useCartStore, useCartTotal } from '@/features/cart/stores/cart'
import { useConfigStore } from '@/shared/stores/config'
import { AppPaymentMethodCard } from '@/features/payment/components/AppPaymentMethodCard'
import type { KioskPaymentMethod } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { MAX_PAYMENT_LEGS } from '@/shared/lib/paymentConfig'

export function PaymentSelect() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const { data: rawMethods = [], isLoading } = usePaymentMethods()
  const total = useCartTotal()
  const items = useCartStore((s) => s.items)
  const useGiftCard = useConfigStore((s) => s.useGiftCard)
  const rate = useExchangeRateStore((s) => s.rate)

  const isGiftCardOrder = items.some(i => i.isGiftCard)
  // generic-partial-payment / payment-flow "Same VPOS Method Selectable":
  // la gift card sigue siendo singleton (giftCardLeg persiste mientras
  // dure la venta) — nunca vuelve a ofrecerse una vez consumida. Los
  // métodos VPOS de `methods` SÍ pueden reelegirse para piernas sucesivas
  // (deliberadamente sin de-dup por method.id acá abajo).
  const showGiftCardOption = useGiftCard && !isGiftCardOrder && !context.giftCardLeg

  // fiscal-tender-code-mapping "Empty printer_code Blocks Method From
  // Split": un método sin printer_code real configurado en Odoo nunca se
  // ofrece para pagar — nunca se inventa un código default (ver
  // printPayload.ts, que explota si un tender llega sin código). El método
  // sintético de tarjeta de regalo (-999) NO pasa por este filtro: su
  // código fiscal es fijo (GIFT_CARD_TENDER_CODE), no viene de Odoo.
  const methods = rawMethods.filter(m => !!m.printerCode)

  const giftCardMethod: KioskPaymentMethod = {
    id: -999,
    name: 'Tarjeta de regalo',
    paymentType: 'card',
    applyIgtf: false,
    igtfPercent: 0,
    journalId: 0,
    currencyId: 0,
    useForChange: false
  }

  // generic-partial-payment "Leg Cap Enforcement": la gift card cuenta como
  // 1 pierna (design.md Cap note). Al llegar al tope se bloquea TODA
  // selección (incluida la propia gift card) con un mensaje claro — el
  // componente nunca despacha nada acá, así que `legs`/`remainingAmount`
  // quedan intactos en el context.
  const legs = context.legs ?? []
  const tenderCount = (context.giftCardLeg ? 1 : 0) + legs.length
  const capReached = tenderCount >= MAX_PAYMENT_LEGS

  const handleSelect = (method: KioskPaymentMethod) => {
    if (capReached) return
    send({ type: 'SELECT_METHOD', method })
    navigate(`/pago/${method.id}`)
  }

  const hasPaidLegs = legs.length > 0 || !!context.giftCardLeg

  return (
    <div className="kiosk-container">
      <h2 className="mb-2 text-center font-extrabold tracking-[-0.05em] [text-wrap:balance]">Selecciona tu método de pago</h2>
      <p className="mb-6 flex items-baseline justify-center gap-2 text-[calc(var(--font-lead)*1.25)] font-medium text-text-muted">
        Total:&nbsp;<strong className="font-extrabold text-accent [font-variant-numeric:tabular-nums]">{formatBs(total)}</strong>
        {rate > 0 && <span className="text-[0.85em] font-normal text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(total / rate)}</span>}
      </p>

      {hasPaidLegs && (
        <div className="mb-6 w-full max-w-[960px] rounded-2xl border border-surface-border bg-surface p-5" data-testid="legs-summary">
          <h3 className="mb-3 px-1 text-[1.05rem] font-bold tracking-[-0.01em] text-text">Pagos ya realizados</h3>
          <div className="flex flex-col gap-2">
            {context.giftCardLeg && (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <span className="flex min-w-0 items-center gap-2.5 font-semibold text-text">
                  <span className="shrink-0 font-extrabold text-text-muted [font-variant-numeric:tabular-nums]">1.</span>
                  <Gift size={22} weight="fill" className="shrink-0 text-accent" />
                  <span className="truncate">Tarjeta de regalo</span>
                </span>
                <span className="shrink-0 text-right font-bold text-text [font-variant-numeric:tabular-nums]">
                  {formatBs(context.giftCardLeg.amount * rate)}
                  {rate > 0 && <span className="ml-2 text-[0.8em] font-normal text-text-muted">{formatUSD(context.giftCardLeg.amount)}</span>}
                </span>
              </div>
            )}
            {/* Enumeradas en el orden en que se cobraron; la tarjeta de regalo,
                cuando existe, ocupa el puesto 1 (cuenta como pierna del tope). */}
            {legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" data-testid={`leg-row-${i}`}>
                <span className="flex min-w-0 items-center gap-2.5 font-semibold text-text">
                  <span className="shrink-0 font-extrabold text-text-muted [font-variant-numeric:tabular-nums]">
                    {(context.giftCardLeg ? 1 : 0) + i + 1}.
                  </span>
                  <CheckCircle size={22} weight="fill" className="shrink-0 text-accent" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{leg.method.name}</span>
                    {(leg.bank || leg.reference) && (
                      <span className="truncate text-[0.8em] font-normal text-text-muted">
                        {[leg.bank, leg.reference && `Ref. ${leg.reference}`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right font-bold text-text [font-variant-numeric:tabular-nums]">
                  {formatBs(leg.amountBs)}
                  {rate > 0 && <span className="ml-2 text-[0.8em] font-normal text-text-muted">{formatUSD(leg.amountBs / rate)}</span>}
                </span>
              </div>
            ))}
          </div>

          {context.remainingAmount !== null && context.remainingAmount !== undefined && (
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-surface-border px-1 pt-3">
              <span className="font-semibold text-text-muted">Restante por pagar</span>
              <strong className="text-[1.3rem] font-extrabold text-accent [font-variant-numeric:tabular-nums]">
                {formatBs(context.remainingAmount)}
                {rate > 0 && <span className="ml-2 text-[0.7em] font-normal text-text-muted">{formatUSD(context.remainingAmount / rate)}</span>}
              </strong>
            </div>
          )}
        </div>
      )}

      {capReached ? (
        <p className="my-4 mb-8 rounded-xl border border-[color-mix(in_srgb,#e53e3e_40%,transparent)] bg-[color-mix(in_srgb,#e53e3e_12%,transparent)] p-4 px-5 text-center text-[1.2rem] font-semibold text-[#e53e3e]">
          Máximo {MAX_PAYMENT_LEGS} medios de pago por venta. No es posible agregar otra pierna de pago.
        </p>
      ) : isLoading ? (
        <p className="my-16 text-xl text-text-muted">Cargando métodos de pago...</p>
      ) : (
        <div className="mb-8 flex w-full max-w-[960px] flex-wrap gap-3 animate-fadeIn">
          {methods.map(method => (
            <AppPaymentMethodCard key={method.id} method={method} onSelect={handleSelect} />
          ))}
          {showGiftCardOption && (
            <AppPaymentMethodCard method={giftCardMethod} onSelect={handleSelect} />
          )}
        </div>
      )}
      <div className="sticky-controls">
      <button
        type="button"
        className="btn  btn-secondary"
        onClick={() => navigate('/productos')}
      >
        Volver a productos
      </button>
      </div>

    </div>
  )
}
