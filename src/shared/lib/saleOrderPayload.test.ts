import { describe, it, expect, beforeEach } from 'vitest'
import { buildSaleOrderPayload } from './saleOrderPayload'
import { useSessionStore } from '@/shared/stores/session'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import type { KioskPartner, CartItem, ActivePayment, KioskPaymentMethod } from '@/shared/types/types'

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

const payment: ActivePayment = {
  methodId: 7,
  amount: 100,
  reference: 'REF-001',
  igtfAmount: 0
}

const attemptId = 'a1b2c3d4-0000-4000-8000-000000000000'

beforeEach(() => {
  useSessionStore.setState({ sessionId: 11, cashierId: 22 })
  useExchangeRateStore.setState({ rate: 40 })
})

describe('buildSaleOrderPayload', () => {
  it('maps customer, session and cashier into the payload', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.partner).toBe(42)
    expect(payload.session).toBe(11)
    expect(payload.cashier).toBe(22)
    expect(payload.isCreditOrder).toBe(false)
  })

  it('uses the attempt id as the dedup id (x_fex_id) instead of generating one per call', () => {
    const first = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    const second = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(first.id).toBe(attemptId)
    expect(second.id).toBe(attemptId)
  })

  it('uses the global currency rate, falling back to 1 when absent', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.rate).toBe(40)

    useExchangeRateStore.setState({ rate: 0 })
    const payloadNoRate = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payloadNoRate.rate).toBe(1)
  })

  it('maps each cart item to a sale order line', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.lines).toEqual([{ product: 1, quantity: 2, priceUnit: 5 }])
  })

  it('maps the payment with reference, amount, journal and IGTF', () => {
    // Para cart totalBs = 100 * 1.16 = 116 Bs.
    // Con applyIgtf: true y igtfPercent: 3% (igtfBs = 3.48 Bs, totalWithIgtfBs = 119.48 Bs).
    // Dividido por globalRate 40 da: amount = 2.987 USD, igtf = 0.087 USD.
    const payload = buildSaleOrderPayload(
      customer,
      cart,
      payment,
      { ...method, applyIgtf: true, igtfPercent: 3 },
      attemptId
    )
    expect(payload.payments).toHaveLength(1)
    const p = payload.payments[0]
    expect(p.ref).toBe('REF-001')
    expect(p.amount).toBe(119.48)   // 116 Bs * 1.03 (3% IGTF)
    expect(p.currency).toBe(2)
    expect(p.rate).toBe(40)
    expect(p.journal).toBe(3)
    expect(p.method).toBe(7)
    expect(p.montoIgtf).toBe(3.48)  // 116 * 0.03
  })

  it('defaults the payment reference to an empty string when missing', () => {
    const payload = buildSaleOrderPayload(customer, cart, { ...payment, reference: '' }, method, attemptId)
    expect(payload.payments[0].ref).toBe('')
  })

  it('sends national currency payments in VES in the payload', () => {
    // Para cart totalBs = 116 Bs. Como es nacional (VES, rate = 1),
    // el monto debe enviarse en la moneda local (bolívares): amount = 116 Bs.
    const payload = buildSaleOrderPayload(
      customer,
      cart,
      payment,
      { ...method, currencyRate: 1, currencyId: 3 }, // currencyId 3 = VES, rate = 1
      attemptId
    )
    
    const p = payload.payments[0]
    expect(p.amount).toBe(116)   // totalBs en bolivares
    expect(p.montoIgtf).toBe(0)
    expect(p.rate).toBe(40)
  })

  it('always includes an empty transactions array required by Odoo post-processing', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.transactions).toEqual([])
  })
})
