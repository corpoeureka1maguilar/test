import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PaymentForm } from './PaymentForm'
import { useCartStore } from '@/features/cart/stores/cart'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import type { KioskPaymentMethod } from '@/shared/types/types'

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

vi.mock('@/features/payment/machines/SaleMachineContext', () => ({
  useSaleMachine: () => ({ send, context: { selectedMethod: method } })
}))

describe('PaymentForm — conversión de moneda del monto a pagar', () => {
  beforeEach(() => {
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
    const call = send.mock.calls[0][0]

    // Total con IVA = 232 Bs. El monto en USD correcto (mismo que se muestra
    // en pantalla como "Total a pagar" -> formatUSD(totalWithIgtfBs / globalRate))
    // es 232 / 40 = 5.8 USD. El código actual usa method.currencyRate (1.5)
    // en su lugar: 232 / 1.5 = 154.67 — un monto ~26x más grande.
    expect(call.payment.amount).toBeCloseTo(5.8, 2)
  })
})
