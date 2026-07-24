import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PaymentSelect } from './PaymentSelect'
import { useCartStore } from '@/features/cart/stores/cart'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import type { GiftCard, KioskPaymentMethod, PaymentLeg } from '@/shared/types/types'
import type { SaleContext } from '@/features/payment/machines/saleMachine'

const send = vi.fn()
let mockContext: Partial<SaleContext> = {}
let mockMethods: KioskPaymentMethod[] = []

vi.mock('@/features/payment/machines/SaleMachineContext', () => ({
  useSaleMachine: () => ({ send, context: mockContext })
}))

vi.mock('@/features/payment/hooks/usePaymentMethods', () => ({
  usePaymentMethods: () => ({ data: mockMethods, isLoading: false })
}))

const giftCardLegFixture: GiftCard = { id: 1, code: 'GC-1', amount: 2, balance: 2, state: 'available' }

// generic-partial-payment / fiscal-tender-code-mapping (tasks 3.5/3.6):
// método VPOS con printerCode real (seleccionable) vs. sin printerCode
// (bloqueado, nunca default de código).
const terminalBanesco: KioskPaymentMethod = {
  id: 7,
  name: 'Terminal Banesco',
  paymentType: 'card',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 3,
  currencyId: 1,
  useForChange: false,
  withMerchant: true,
  printerCode: '05'
}

const terminalSinCodigo: KioskPaymentMethod = {
  id: 8,
  name: 'Terminal Sin Codigo',
  paymentType: 'card',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 4,
  currencyId: 1,
  useForChange: false,
  withMerchant: true,
  printerCode: ''
}

function legFixture(method: KioskPaymentMethod, baseBs: number): PaymentLeg {
  return { method, baseBs, montoIgtf: 0, amountBs: baseBs, reference: 'REF-1', ts: Date.now() }
}

describe('PaymentSelect — Scenario 4 (no más de 2 legs, ocultar tarjeta de regalo en el 2do leg)', () => {
  beforeEach(() => {
    send.mockClear()
    mockContext = {}
    mockMethods = []
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    useConfigStore.setState({ useGiftCard: true })
  })

  it('muestra la opción "Tarjeta de regalo" cuando NO hay giftCardLeg en el context (regresión, primer leg)', () => {
    mockContext = {}
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.getByText('Tarjeta de regalo')).toBeInTheDocument()
  })

  it('oculta la opción "Tarjeta de regalo" cuando context.giftCardLeg ya está seteado (segundo leg, ya se consumió la tarjeta)', () => {
    mockContext = { giftCardLeg: giftCardLegFixture }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.queryByText('Tarjeta de regalo')).not.toBeInTheDocument()
  })
})

describe('PaymentSelect — re-selección de método VPOS ya usado (generic-partial-payment / payment-flow "Same VPOS Method Selectable")', () => {
  beforeEach(() => {
    send.mockClear()
    mockContext = { legs: [legFixture(terminalBanesco, 50)], remainingAmount: 30 }
    mockMethods = [terminalBanesco]
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    useConfigStore.setState({ useGiftCard: false })
  })

  it('un método ya usado en una pierna completada SIGUE siendo seleccionable (sin de-dup accidental)', () => {
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.getByText('Terminal Banesco')).toBeInTheDocument()
    screen.getByText('Terminal Banesco').closest('button')!.click()

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toEqual({ type: 'SELECT_METHOD', method: terminalBanesco })
  })
})

describe('PaymentSelect — filtro por printerCode (fiscal-tender-code-mapping "Empty printer_code Blocks Method From Split")', () => {
  beforeEach(() => {
    send.mockClear()
    mockContext = {}
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    useConfigStore.setState({ useGiftCard: true })
  })

  it('un método con printerCode vacío/falsy queda excluido de la selección', () => {
    mockMethods = [terminalSinCodigo]
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.queryByText('Terminal Sin Codigo')).not.toBeInTheDocument()
  })

  it('el método sintético de tarjeta de regalo NO se filtra por printerCode (código fijo, no viene de Odoo)', () => {
    mockMethods = [terminalSinCodigo]
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.getByText('Tarjeta de regalo')).toBeInTheDocument()
  })

  it('un método CON printerCode real permanece seleccionable', () => {
    mockMethods = [terminalBanesco, terminalSinCodigo]
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.getByText('Terminal Banesco')).toBeInTheDocument()
    expect(screen.queryByText('Terminal Sin Codigo')).not.toBeInTheDocument()
  })
})

describe('PaymentSelect — tope de piernas (generic-partial-payment "Leg Cap Enforcement", MAX_PAYMENT_LEGS=4)', () => {
  beforeEach(() => {
    send.mockClear()
    mockMethods = [terminalBanesco]
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    useConfigStore.setState({ useGiftCard: true })
  })

  it('bloquea TODA selección (incluida la tarjeta de regalo) cuando (giftCardLeg?1:0)+legs.length >= MAX_PAYMENT_LEGS, con mensaje claro', () => {
    const legs = [legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10)]
    mockContext = { giftCardLeg: giftCardLegFixture, legs, remainingAmount: 10 }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.queryByText('Terminal Banesco')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarjeta de regalo')).not.toBeInTheDocument()
    expect(screen.getByText(/Máximo 4 medios de pago/)).toBeInTheDocument()
  })

  it('bajo el tope, la selección sigue habilitada y no se muestra el mensaje de tope', () => {
    const legs = [legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10)]
    mockContext = { legs, remainingAmount: 10 }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.getByText('Terminal Banesco')).toBeInTheDocument()
    expect(screen.queryByText(/Máximo 4 medios de pago/)).not.toBeInTheDocument()
  })

  it('al llegar al tope, legs/remainingAmount existentes quedan intactos (el componente no despacha nada)', () => {
    const legs = [legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10), legFixture(terminalBanesco, 10)]
    mockContext = { legs, remainingAmount: 5 }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(send).not.toHaveBeenCalled()
    expect(mockContext.legs).toBe(legs)
    expect(mockContext.remainingAmount).toBe(5)
  })
})

describe('PaymentSelect — render de piernas acumuladas + remanente (legs.length > 0)', () => {
  beforeEach(() => {
    send.mockClear()
    mockMethods = [terminalBanesco]
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    useConfigStore.setState({ useGiftCard: false })
  })

  it('no renderiza el resumen de piernas cuando legs.length === 0 (regresión, primer leg)', () => {
    mockContext = { legs: [] }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    expect(screen.queryByTestId('legs-summary')).not.toBeInTheDocument()
  })

  it('renderiza piernas acumuladas + remanente cuando legs.length > 0', () => {
    const legs = [legFixture(terminalBanesco, 50)]
    mockContext = { legs, remainingAmount: 30 }
    render(<MemoryRouter><PaymentSelect /></MemoryRouter>)

    const summary = screen.getByTestId('legs-summary')
    expect(summary.textContent).toContain('Piernas cobradas: 1')
    expect(summary.textContent).toContain('Restante')
  })
})
