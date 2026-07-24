import { describe, it, expect, beforeEach } from 'vitest'
import { buildSaleOrderPayload } from './saleOrderPayload'
import { useSessionStore } from '@/shared/stores/session'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { calcIgtf } from '@/shared/lib/paymentUtils'
import type { KioskPartner, CartItem, KioskPaymentMethod, GiftCard, PaymentLeg } from '@/shared/types/types'

const customer: KioskPartner = { id: 42, name: 'Juan Perez', cedula: 'V-12345678' }

const cart: CartItem[] = [
  { productId: 1, name: 'Producto A', defaultCode: 'P-A', price: 50, priceUsd: 5, taxRate: 0.16, qty: 2, subtotal: 100 }
]

const method: KioskPaymentMethod = {
  id: 7,
  name: 'Pago móvil',
  paymentType: 'pago_movil',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 3,
  currencyId: 2,
  currencyRate: 1.5,
  useForChange: false
}

const attemptId = 'a1b2c3d4-0000-4000-8000-000000000000'

// cart totalBs (con IVA) = 100 * 1.16 = 116 Bs — usado como baseBs por
// defecto para representar "un solo tender cubre el total" en los tests que
// no ejercitan el split N-leg explícitamente.
const leg = (overrides: Partial<PaymentLeg> = {}): PaymentLeg => ({
  method,
  baseBs: 116,
  montoIgtf: 0,
  amountBs: 116,
  reference: 'REF-001',
  ts: 1,
  ...overrides
})

beforeEach(() => {
  useSessionStore.setState({ sessionId: 11, cashierId: 22 })
  useExchangeRateStore.setState({ rate: 40 })
})

describe('buildSaleOrderPayload — new legs[] signature (customer, cart, legs, attemptId, giftCard)', () => {
  it('maps customer, session and cashier into the payload', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(payload.partner).toBe(42)
    expect(payload.session).toBe(11)
    expect(payload.cashier).toBe(22)
    expect(payload.isCreditOrder).toBe(false)
  })

  it('uses the attempt id as the dedup id (x_fex_id) instead of generating one per call', () => {
    const first = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    const second = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(first.id).toBe(attemptId)
    expect(second.id).toBe(attemptId)
  })

  it('uses the global currency rate, falling back to 1 when absent', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(payload.rate).toBe(40)

    useExchangeRateStore.setState({ rate: 0 })
    const payloadNoRate = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(payloadNoRate.rate).toBe(1)
  })

  it('maps each cart item to a sale order line', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(payload.lines).toEqual([{ product: 1, quantity: 2, priceUnit: 5 }])
  })

  it('maps a single leg to a payment entry with reference, amount, journal and per-leg IGTF computed via calcIgtf (never hardcoded)', () => {
    const igtfMethod: KioskPaymentMethod = { ...method, applyIgtf: true, igtfPercent: 3 }
    const expectedIgtf = calcIgtf(igtfMethod, 116) // 3% of the 116 Bs base -> 3.48
    const payload = buildSaleOrderPayload(
      customer,
      cart,
      [leg({ method: igtfMethod, baseBs: 116, amountBs: 116 + expectedIgtf })],
      attemptId
    )
    expect(payload.payments).toHaveLength(1)
    const p = payload.payments[0]!
    expect(p.ref).toBe('REF-001')
    expect(p.amount).toBe(116 + expectedIgtf)
    expect(p.currency).toBe(2)
    expect(p.rate).toBe(40)
    expect(p.journal).toBe(3)
    expect(p.method).toBe(7)
    // requirement #9: IGTF is always calcIgtf(leg.method, leg.baseBs), computed
    // fresh by buildSaleOrderPayload itself — never trusted/hardcoded elsewhere.
    expect(p.montoIgtf).toBe(expectedIgtf)
    expect(p.montoIgtf).toBe(calcIgtf(igtfMethod, 116))
  })

  it('defaults the payment reference to an empty string when missing', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg({ reference: '' })], attemptId)
    expect(payload.payments[0]!.ref).toBe('')
  })

  it('sends national currency payments in VES in the payload', () => {
    // totalBs = 116 Bs. Método nacional (VES, rate = 1): el monto se envía
    // en la moneda local (bolívares) tal cual, sin dividir por la tasa.
    const vesMethod: KioskPaymentMethod = { ...method, currencyRate: 1, currencyId: 3 }
    const payload = buildSaleOrderPayload(customer, cart, [leg({ method: vesMethod })], attemptId)
    const p = payload.payments[0]!
    expect(p.amount).toBe(116)
    expect(p.montoIgtf).toBe(0)
    expect(p.rate).toBe(40)
  })

  it('always includes an empty transactions array required by Odoo post-processing', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId)
    expect(payload.transactions).toEqual([])
  })
})

describe('buildSaleOrderPayload — N-leg composition (generic-partial-payment / IGTF Calculated Per Leg)', () => {
  it('payments.length === legs.length, and each amount/IGTF is computed independently per leg', () => {
    const methodA: KioskPaymentMethod = { ...method, id: 3, journalId: 9, currencyId: 1, applyIgtf: true, igtfPercent: 3 }
    const methodB: KioskPaymentMethod = { ...method, id: 4, journalId: 10, currencyId: 1, applyIgtf: false, igtfPercent: 0 }
    const legA = leg({ method: methodA, baseBs: 30, amountBs: 30 + calcIgtf(methodA, 30), reference: 'REF-A' })
    const legB = leg({ method: methodB, baseBs: 20, amountBs: 20, reference: 'REF-B' })

    const payload = buildSaleOrderPayload(customer, cart, [legA, legB], attemptId)

    expect(payload.payments).toHaveLength(2)
    expect(payload.payments[0]!.amount).toBe(legA.amountBs)
    expect(payload.payments[0]!.montoIgtf).toBe(calcIgtf(methodA, 30))
    expect(payload.payments[0]!.ref).toBe('REF-A')
    expect(payload.payments[1]!.amount).toBe(legB.amountBs)
    expect(payload.payments[1]!.montoIgtf).toBe(calcIgtf(methodB, 20))
    expect(payload.payments[1]!.montoIgtf).toBe(0)
    expect(payload.payments[1]!.ref).toBe('REF-B')
  })
})

describe('buildSaleOrderPayload — gift card leg (regression, gift-card-partial-payment)', () => {
  const partialGiftCard: GiftCard = { id: 5, code: 'GC-100', amount: 2, balance: 2, state: 'available' }

  it('gift-card partial remainder + 1 tender leg: payments has exactly the tender leg, giftCard carries the consumed amount', () => {
    // remainderBs = round2(116 - consumedUSD(2) * rate(40)) = round2(116 - 80) = 36
    const remainderLeg = leg({ baseBs: 36, amountBs: 36, montoIgtf: 0 })
    const payload = buildSaleOrderPayload(customer, cart, [remainderLeg], attemptId, partialGiftCard)

    expect(payload.payments).toHaveLength(1)
    const p = payload.payments[0]!
    expect(p.amount).toBe(36)
    expect(p.montoIgtf).toBe(0)
    expect(payload.giftCard).toBeDefined()
    expect(payload.giftCard?.amount).toBe(2)
  })

  it('documented conscious behavior change (requirement #9): an IGTF-applying method used for the remainder leg is NO LONGER forced to montoIgtf: 0 — it now reflects calcIgtf(method, baseBs) for that leg', () => {
    const igtfMethod: KioskPaymentMethod = { ...method, applyIgtf: true, igtfPercent: 3 }
    const expectedIgtf = calcIgtf(igtfMethod, 36)
    const remainderLeg = leg({ method: igtfMethod, baseBs: 36, amountBs: 36 + expectedIgtf })
    const payload = buildSaleOrderPayload(customer, cart, [remainderLeg], attemptId, partialGiftCard)

    const p = payload.payments[0]!
    expect(p.montoIgtf).toBe(expectedIgtf)
    expect(p.montoIgtf).toBe(calcIgtf(igtfMethod, 36))
  })

  it('regression: full gift card (single leg with method.id === -999) still produces payments: [], never leaking into payments', () => {
    const fullGiftCard: GiftCard = { id: 6, code: 'GC-200', amount: 2.9, balance: 2.9, state: 'available' }
    const giftCardMethod: KioskPaymentMethod = { ...method, id: -999 }
    const payload = buildSaleOrderPayload(
      customer,
      cart,
      [leg({ method: giftCardMethod })],
      attemptId,
      fullGiftCard
    )
    expect(payload.payments).toEqual([])
    expect(payload.giftCard?.amount).toBe(2.9)
  })

  it('regression: normal single-leg payment (no gift card) stays unchanged', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId, null)
    expect(payload.payments).toHaveLength(1)
    expect(payload.payments[0]!.montoIgtf).toBe(0)
    expect(payload.giftCard).toBeUndefined()
  })

  it('gift card partial + 2 sequential legs: payments has 2 entries which, together with the consumed gift-card amount, sum to the order total', () => {
    const legA = leg({ baseBs: 30, amountBs: 30, reference: 'REF-A' })
    const legB = leg({ baseBs: 6, amountBs: 6, reference: 'REF-B' })
    const payload = buildSaleOrderPayload(customer, cart, [legA, legB], attemptId, partialGiftCard)

    expect(payload.payments).toHaveLength(2)
    const sumPayments = payload.payments.reduce((sum, p) => sum + p.amount, 0)
    // partialGiftCard.amount(2 USD) * rate(40) = 80 Bs consumidos; 80 + 30 + 6 = 116 = totalBs
    expect(sumPayments + partialGiftCard.amount * 40).toBe(116)
  })

  it('never produces more legs in payments than were passed in (no implicit gift-card leg injection)', () => {
    const payload = buildSaleOrderPayload(customer, cart, [leg()], attemptId, partialGiftCard)
    expect(payload.payments.length).toBeLessThanOrEqual(1)
  })
})
