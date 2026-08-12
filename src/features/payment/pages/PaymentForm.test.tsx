import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PaymentForm } from './PaymentForm'
import { useCartStore } from '@/features/cart/stores/cart'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import type { GiftCard, KioskPaymentMethod } from '@/shared/types/types'
import type { SaleContext } from '@/features/payment/machines/saleMachine'

const send = vi.fn()

// Método de pago en moneda extranjera (tarjeta USD): currencyRate viene del
// campo `rate` de res.currency para SU moneda — no tiene por qué coincidir
// con la tasa BCV (globalRate) usada para construir los precios del carrito.
const method: KioskPaymentMethod = {
  id: 9,
  name: 'Tarjeta USD',
  paymentType: 'card',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 4,
  currencyId: 2,
  currencyRate: 1.5,
  useForChange: false
}

// Mock del context de la state machine, mutable por test (algunas suites
// necesitan setear remainingAmount/giftCardLeg para el segundo leg del pago
// parcial de tarjeta de regalo).
let mockContext: Partial<SaleContext> = { selectedMethod: method }

vi.mock('@/features/payment/machines/SaleMachineContext', () => ({
  useSaleMachine: () => ({ send, context: mockContext })
}))

describe('PaymentForm — conversión de moneda del monto a pagar', () => {
  beforeEach(() => {
    mockContext = { selectedMethod: method }
    send.mockClear()
    // Carrito: 1 producto con subtotal (sin IVA) = 200 Bs, IVA 16% -> total = 232 Bs
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    // Tasa BCV usada para construir price/subtotal en Bs a partir de USD
    useExchangeRateStore.setState({ rate: 40 })
  })

  it('envía el amount en la MISMA tasa (globalRate) que se le muestra al cliente como equivalente en USD', () => {
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/Referencia/i, { selector: 'input' }) ?? screen.getByPlaceholderText(/referencia/i), {
      target: { value: 'REF-123' }
    })
    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0]![0]

    // Total con IVA = 232 Bs. El monto en USD correcto (mismo que se muestra
    // en pantalla como "Total a pagar" -> formatUSD(totalWithIgtfBs / globalRate))
    // es 232 / 40 = 5.8 USD. El código actual usa method.currencyRate (1.5)
    // en su lugar: 232 / 1.5 = 154.67 — un monto ~26x más grande.
    expect(call.payment.amount).toBeCloseTo(5.8, 2)
  })
})

// Método local (Bs, sin IGTF ni currencyRate) para el segundo leg del pago
// parcial de tarjeta de regalo — así paymentAmount == totalWithIgtfBs (Bs)
// y fields=[] (paymentType 'cash') no exige ningún campo adicional en el form.
const localMethod: KioskPaymentMethod = {
  id: 3,
  name: 'Efectivo Bs',
  paymentType: 'cash',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 7,
  currencyId: 1,
  useForChange: false
}

const giftCardLegFixture: GiftCard = { id: 1, code: 'GC-1', amount: 2, balance: 2, state: 'available' }

describe('PaymentForm — remanente de tarjeta de regalo (pago parcial 2-leg, Scenario 2)', () => {
  beforeEach(() => {
    send.mockClear()
    // Carrito: total = 232 Bs — pero el segundo leg NO debe usar este total
    // completo, sino context.remainingAmount (36 Bs, ya calculado por el
    // primer leg de tarjeta de regalo).
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    mockContext = { selectedMethod: localMethod, remainingAmount: 36, giftCardLeg: giftCardLegFixture }
  })

  it('cuando context.remainingAmount está seteado (segundo leg), usa ese monto como total efectivo (36 Bs) en vez del total completo del carrito (232 Bs)', () => {
    render(<MemoryRouter><PaymentRouter /></MemoryRouter>)

    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0]![0]
    expect(call.payment.amount).toBe(36)
  })

  it('regresión: sin remainingAmount (leg único), sigue usando el total completo del carrito', () => {
    mockContext = { selectedMethod: localMethod }
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0]![0]
    expect(call.payment.amount).toBe(232)
  })
})

// Método VPOS (withMerchant) para probar el wiring de LegAmountInput
// (generic-partial-payment, tasks 3.3/3.4): PaymentForm debe mostrar el
// input de monto ANTES del iframe del terminal, y gatear el ping hasta que
// el cajero confirme.
const vposMethod: KioskPaymentMethod = {
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

describe('PaymentForm — wiring de LegAmountInput (generic-partial-payment 3.3/3.4)', () => {
  beforeEach(() => {
    send.mockClear()
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra LegAmountInput (no el iframe VPOS) ANTES de confirmar el monto — el ping queda gateado', () => {
    mockContext = { selectedMethod: vposMethod, remainingAmount: 80 }
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    expect(screen.getByText('Confirmar monto')).toBeInTheDocument()
    expect(screen.queryByTitle('VPOS Checkout')).not.toBeInTheDocument()
  })

  it('tras confirmar el monto, muestra la vista del terminal VPOS (iframe/spinner) y arranca el ping', async () => {
    mockContext = { selectedMethod: vposMethod, remainingAmount: 80 }
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    fireEvent.click(screen.getByText('Confirmar monto'))

    expect(screen.queryByText('Confirmar monto')).not.toBeInTheDocument()
    // vposStatus arranca en 'checking' (spinner) y pasa a 'waiting' (iframe)
    // una vez el ping resuelve — cualquiera de los dos confirma que se dejó
    // LegAmountInput y se entró a la vista del terminal VPOS.
    expect(await screen.findByText('Cancelar y Volver')).toBeInTheDocument()
  })
})

// Transferencia bancaria: cobro parcial MANUAL (generic-partial-payment).
// Mismo paso de monto que VPOS, pero cierra con banco + referencia y emite
// LEG_PAID (una pierna), no SUBMIT_PAYMENT.
const transferMethod: KioskPaymentMethod = {
  id: 11,
  name: 'Transferencia Banesco',
  paymentType: 'transferencia',
  applyIgtf: false,
  igtfPercent: 0,
  journalId: 8,
  currencyId: 1,
  useForChange: false,
  printerCode: '05'
}

describe('PaymentForm — pago parcial por transferencia bancaria', () => {
  beforeEach(() => {
    send.mockClear()
    // Carrito: subtotal 200 Bs + IVA 16% = 232 Bs
    useCartStore.setState({
      items: [{
        productId: 1, name: 'Producto A', defaultCode: 'P-A',
        price: 232, priceUsd: 6, taxRate: 0.16, qty: 1, subtotal: 200
      }]
    })
    useExchangeRateStore.setState({ rate: 40 })
    mockContext = { selectedMethod: transferMethod }
  })

  const fillDetails = (bank: string, reference: string) => {
    fireEvent.change(screen.getByLabelText(/Banco/i, { selector: 'input' }), { target: { value: bank } })
    fireEvent.change(screen.getByLabelText(/Referencia/i, { selector: 'input' }), { target: { value: reference } })
  }

  it('pide el monto de la pierna ANTES del formulario de banco/referencia', () => {
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    expect(screen.getByText('Confirmar monto')).toBeInTheDocument()
    expect(screen.queryByText('Confirmar pago')).not.toBeInTheDocument()
  })

  it('cobra parcial: emite LEG_PAID con el monto confirmado (100 de 232) y NO cierra la venta', () => {
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('Confirmar monto'))

    fillDetails('Banesco', 'REF-100')
    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0]![0]
    expect(call.type).toBe('LEG_PAID')
    expect(call.baseBs).toBe(100)
    expect(call.method.id).toBe(transferMethod.id)
    expect(call.payment.reference).toBe('REF-100')
    expect(call.payment.bank).toBe('Banesco')
  })

  it('cobra el remanente completo cuando el cajero confirma sin editar (una sola transferencia cierra la venta)', () => {
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    fireEvent.click(screen.getByText('Confirmar monto'))
    fillDetails('Banesco', 'REF-FULL')
    fireEvent.click(screen.getByText('Confirmar pago'))

    const call = send.mock.calls[0]![0]
    expect(call.type).toBe('LEG_PAID')
    expect(call.baseBs).toBe(232)
  })

  it('sobre un remanente previo (gift card / pierna anterior), el tope del monto es el remanente, no el total', () => {
    mockContext = { selectedMethod: transferMethod, remainingAmount: 80 }
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('80')
    expect(input.max).toBe('80')

    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.click(screen.getByText('Confirmar monto'))
    fillDetails('Mercantil', 'REF-80')
    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send.mock.calls[0]![0].baseBs).toBeLessThanOrEqual(80)
  })

  it('regresión: un método manual NO parcial (efectivo) sigue emitiendo SUBMIT_PAYMENT sin paso de monto', () => {
    mockContext = { selectedMethod: localMethod }
    render(<MemoryRouter><PaymentForm /></MemoryRouter>)

    expect(screen.queryByText('Confirmar monto')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmar pago'))

    expect(send.mock.calls[0]![0].type).toBe('SUBMIT_PAYMENT')
  })
})
