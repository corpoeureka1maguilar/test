import type { KioskPartner, CartItem, ActivePayment, KioskPaymentMethod } from '@/shared/types/types'

export function buildSaleOrderPayload(
  customer: KioskPartner,
  cart: CartItem[],
  payment: ActivePayment,
  method: KioskPaymentMethod
) {
  return {
    // UUID string → x_fex_id para deduplicar
    id: crypto.randomUUID(),

    // Campos que lee _action_parse_pos_data de sale.order
    partner: customer.id,
    isCreditOrder: false,
    rate: 1,
    date: new Date().toISOString(),

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
      rate:      1,
      journal:   method.journalId,
      method:    method.id,
      montoIgtf: payment.igtfAmount
    }]
  }
}
