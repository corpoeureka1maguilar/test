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

  const globalRate = useExchangeRateStore.getState().rate || 1

  // Calcular el total con IVA en bolívares
  const totalBs = cart.reduce((sum, item) => sum + (item.subtotal * (1 + item.taxRate)), 0)

  // Calcular IGTF en bolívares si aplica
  const igtfPercent = method.igtfPercent || 0
  const igtfBs = method.applyIgtf ? totalBs * (igtfPercent / 100) : 0
  const totalWithIgtfBs = totalBs + igtfBs

  // Si el método de pago es extranjero (USD), el monto del pago se envía en dólares.
  // Si es nacional (VES), se envía en bolívares.
  const isForeign = !!method.currencyRate && method.currencyRate > 1
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100
  const paymentAmount = round2(isForeign ? (totalWithIgtfBs / globalRate) : totalWithIgtfBs)
  const paymentIgtf = round2(isForeign ? (igtfBs / globalRate) : igtfBs)

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
      amount:    paymentAmount,
      currency:  method.currencyId,
      rate:      globalRate,
      journal:   method.journalId,
      method:    method.id,
      montoIgtf: paymentIgtf
    }]
  }
}

