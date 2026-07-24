import type { KioskPartner, CartItem, PaymentLeg, GiftCard } from '@/shared/types/types'
import { useSessionStore } from '@/shared/stores/session'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { odooEnv } from '@/shared/lib/odooEnv'
import { randomUUID } from '@/shared/lib/cryptoUtils'
import { calcIgtf } from '@/shared/lib/paymentUtils'

/**
 * generic-partial-payment (Fase 2): firma generalizada a N piernas
 * (`legs: PaymentLeg[]`) + una gift card opcional (`giftCard`, singleton —
 * NUNCA vive en `legs[]`, ver design.md Decision 1). Cada pierna ya trae su
 * propio `baseBs`/`amountBs`/`reference` resueltos (por `commitLeg` para
 * piernas VPOS, o sintetizados por `buildLegsInput` en saleMachine.ts para
 * el camino legacy) — esta función NO recalcula totales desde el carrito ni
 * fuerza `montoIgtf` a 0: cada pago usa `calcIgtf(leg.method, leg.baseBs)`
 * de forma independiente (spec "IGTF Calculated Per Leg", requirement #9 —
 * nunca hardcodeado, aunque el resultado numérico hoy sea 0 porque ningún
 * método productivo tiene `applyIgtf: true`).
 */
export function buildSaleOrderPayload(
  customer: KioskPartner,
  cart: CartItem[],
  legs: PaymentLeg[],
  attemptId: string,
  giftCard: GiftCard | null = null
) {
  const sessionId = useSessionStore.getState().sessionId
  const cashierId = useSessionStore.getState().cashierId
  const stationId = useConfigStore.getState().stationId
  const pricelistId = useConfigStore.getState().pricelistId
  const uid = odooEnv.uid

  const globalRate = useExchangeRateStore.getState().rate || 1

  const formattedGiftCard = giftCard ? (
    giftCard.state === 'new' ? {
      id: giftCard.id,
      code: giftCard.code,
      amount: giftCard.amount,
      state: 'new'
    } : {
      id: giftCard.id,
      code: giftCard.code,
      amount: giftCard.amount,
      balance: giftCard.balance,
      state: 'available'
    }
  ) : undefined

  // Pago completo con tarjeta de regalo (method.id === -999, pierna
  // sintética del camino legacy vía buildLegsInput en saleMachine.ts): NUNCA
  // es un tender de Odoo — la tarjeta va en payload.giftCard, no en
  // payments[]. Filtrar por method.id reproduce byte a byte el
  // `payments: []` de hoy sin necesitar un flag `isFullGiftCard` aparte.
  const tenderLegs = legs.filter(leg => leg.method.id !== -999)

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

    // Pricelist por defecto de la sucursal — _action_parse_pos_data la mapea
    // a sale.order.pricelist_id cuando viene presente
    pricelist: pricelistId || undefined,

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

    // Tarjeta de regalo
    giftCard: formattedGiftCard,

    // Pagos — field names que lee _action_parse_pos_data de account.payment.fex.
    // Un entry por pierna (no-gift-card); cada IGTF se computa per-leg, nunca
    // hardcodeado (ver comentario del módulo).
    payments: tenderLegs.map(leg => ({
      id:         randomUUID(),
      isChange:   false,
      date:       new Date().toISOString(),
      ref:        leg.reference || '',
      amount:     leg.amountBs,
      currency:   leg.method.currencyId,
      rate:       globalRate,
      journal:    leg.method.journalId,
      method:     leg.method.id,
      montoIgtf:  calcIgtf(leg.method, leg.baseBs)
    }))
  }
}
