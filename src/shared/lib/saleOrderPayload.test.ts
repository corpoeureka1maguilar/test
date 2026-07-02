import { describe, it, expect, beforeEach } from 'vitest'
import { buildSaleOrderPayload } from './saleOrderPayload'
import { useSessionStore } from '@/shared/stores/session'
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

  it('uses the method currency rate, falling back to 1 when absent', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.rate).toBe(1.5)

    const payloadNoRate = buildSaleOrderPayload(customer, cart, payment, { ...method, currencyRate: undefined }, attemptId)
    expect(payloadNoRate.rate).toBe(1)
  })

  it('maps each cart item to a sale order line', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.lines).toEqual([{ product: 1, quantity: 2, priceUnit: 50 }])
  })

  it('maps the payment with reference, amount, journal and IGTF', () => {
    const payload = buildSaleOrderPayload(customer, cart, { ...payment, igtfAmount: 3.5 }, method, attemptId)
    expect(payload.payments).toHaveLength(1)
    expect(payload.payments[0]).toMatchObject({
      ref: 'REF-001',
      amount: 100,
      currency: 2,
      rate: 1.5,
      journal: 3,
      method: 7,
      montoIgtf: 3.5
    })
  })

  it('defaults the payment reference to an empty string when missing', () => {
    const payload = buildSaleOrderPayload(customer, cart, { ...payment, reference: '' }, method, attemptId)
    expect(payload.payments[0].ref).toBe('')
  })

  it('always includes an empty transactions array required by Odoo post-processing', () => {
    const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
    expect(payload.transactions).toEqual([])
  })
})
