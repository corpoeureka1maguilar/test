import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePaymentMethods } from '@/features/payment/hooks/usePaymentMethods'
import { useCartStore, useCartTotal } from '@/features/cart/stores/cart'
import { useConfigStore } from '@/shared/stores/config'
import { AppPaymentMethodCard } from '@/features/payment/components/AppPaymentMethodCard'
import type { KioskPaymentMethod } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { MAX_PAYMENT_LEGS } from '@/shared/lib/paymentConfig'
import styles from './PaymentSelect.module.css'

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

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Selecciona tu método de pago</h2>
      <p className={styles.total}>
        Total:&nbsp;<strong>{formatBs(total)}</strong>
        {rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}
      </p>

      {legs.length > 0 && (
        <p className={styles.legsSummary} data-testid="legs-summary">
          Piernas cobradas: <strong>{legs.length}</strong>
          {context.remainingAmount !== null && context.remainingAmount !== undefined && (
            <> — Restante:&nbsp;<strong>{formatBs(context.remainingAmount)}</strong></>
          )}
        </p>
      )}

      {capReached ? (
        <p className={styles.capMessage}>
          Máximo {MAX_PAYMENT_LEGS} medios de pago por venta. No es posible agregar otra pierna de pago.
        </p>
      ) : isLoading ? (
        <p className={styles.loading}>Cargando métodos de pago...</p>
      ) : (
        <div className={styles.grid}>
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
