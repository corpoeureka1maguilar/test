import type { KioskPartner, CartItem, ActivePayment, KioskPaymentMethod } from '@/shared/types/types'
import { useSessionStore } from '@/shared/stores/session'
import { odooEnv } from '@/shared/lib/odooEnv'

export function buildSaleOrderPayload(
  customer: KioskPartner,
  cart: CartItem[],
  payment: ActivePayment,
  method: KioskPaymentMethod
) {
  const sessionId = useSessionStore.getState().sessionId
  const cashierId = useSessionStore.getState().cashierId
  const uid = odooEnv.uid

  return {
    // UUID string → x_fex_id para deduplicar
    id: crypto.randomUUID(),

    // Campos que lee _action_parse_pos_data de sale.order
    partner: customer.id,
    isCreditOrder: false,
    rate: method.currencyRate || 1,
    date: new Date().toISOString(),
    
    // Sesión y Cajero
    user: uid || undefined,
    cashier: cashierId || undefined,
    session: sessionId || undefined,

    // Líneas — field names que lee _action_parse_pos_data de sale.order.line
    lines: cart.map(item => ({
      product:   item.productId,
      quantity:  item.qty,
      priceUnit: item.price
    })),

    // Requerido por _action_post_process_order (KeyError si no existe)
    transactions: [],

    // Pagos — field names que lee _action_parse_pos_data de account.payment.fex
    payments: [{
      id:         crypto.randomUUID(),
      isChange:   false,
      date:       new Date().toISOString(),
      ref:        payment.reference || '',
      amount:    payment.amount,
      currency:  method.currencyId,
      rate:      method.currencyRate || 1,
      journal:   method.journalId,
      method:    method.id,
      montoIgtf: payment.igtfAmount
    }]
  }
}

