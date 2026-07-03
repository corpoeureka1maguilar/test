import type { KioskPartner, CartItem, ActivePayment, KioskPaymentMethod } from '@/shared/types/types'
import { useSessionStore } from '@/shared/stores/session'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { odooEnv } from '@/shared/lib/odooEnv'
import { randomUUID } from '@/shared/lib/cryptoUtils'

export function buildSaleOrderPayload(
  customer: KioskPartner,
  cart: CartItem[],
  payment: ActivePayment,
  method: KioskPaymentMethod,
  attemptId: string
) {
  const sessionId = useSessionStore.getState().sessionId
  const cashierId = useSessionStore.getState().cashierId
  const stationId = useConfigStore.getState().stationId
  const uid = odooEnv.uid

  const isForeign = !!method.currencyRate && method.currencyRate > 1
  const globalRate = useExchangeRateStore.getState().rate || 1
  const paymentAmountUsd = isForeign ? payment.amount : payment.amount / globalRate
  const paymentIgtfUsd = isForeign ? payment.igtfAmount : payment.igtfAmount / globalRate

  return {
    // UUID string → x_fex_id para deduplicar. Se genera UNA vez por intento de
    // venta (en la state machine) y se reutiliza en cada reintento: si Odoo
    // creó la orden pero la respuesta se perdió (timeout), el retry llega con
    // el mismo id y el backend lo deduplica en vez de crear una orden gemela
    id: attemptId,

    // Campos que lee _action_parse_pos_data de sale.order
    partner: customer.id,
    isCreditOrder: false,
    rate: globalRate,
    date: new Date().toISOString(),

    // Sesión, Cajero y Estación
    user: uid || undefined,
    cashier: cashierId || undefined,
    session: sessionId || undefined,
    station: stationId || undefined,

    // Líneas — field names que lee _action_parse_pos_data de sale.order.line
    lines: cart.map(item => ({
      product:   item.productId,
      quantity:  item.qty,
      priceUnit: item.priceUsd
    })),

    // Requerido por _action_post_process_order (KeyError si no existe)
    transactions: [],

    // Pagos — field names que lee _action_parse_pos_data de account.payment.fex
    payments: [{
      id:         randomUUID(),
      isChange:   false,
      date:       new Date().toISOString(),
      ref:        payment.reference || '',
      amount:    paymentAmountUsd,
      currency:  method.currencyId,
      rate:      globalRate,
      journal:   method.journalId,
      method:    method.id,
      montoIgtf: paymentIgtfUsd
    }]
  }
}

