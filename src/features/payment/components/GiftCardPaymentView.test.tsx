import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GiftCard } from '@/shared/types/types'
import { GiftCardPaymentView } from './GiftCardPaymentView'

// total = 116 Bs, globalRate = 40 -> orderTotalUSD = 2.9
const TOTAL_BS = 116
const GLOBAL_RATE = 40
const ORDER_TOTAL_USD = 2.9

function baseProps(overrides: Partial<React.ComponentProps<typeof GiftCardPaymentView>> = {}) {
  return {
    total: TOTAL_BS,
    globalRate: GLOBAL_RATE,
    orderTotalUSD: ORDER_TOTAL_USD,
    foundCard: null,
    hasSufficientBalance: false,
    consumedAmountUSD: 0,
    remainingBs: 0,
    giftCardCode: '',
    onGiftCardCodeChange: vi.fn(),
    searchingCard: false,
    cardError: null,
    showKeyboard: false,
    onShowKeyboardChange: vi.fn(),
    onSearchCard: vi.fn(),
    onGiftCardSubmit: vi.fn(),
    onUseAnotherCard: vi.fn(),
    onBack: vi.fn(),
    ...overrides
  }
}

describe('GiftCardPaymentView — Scenario 2 (partial balance, 0 < balance < total)', () => {
  it('shows "Saldo a consumir ($)" input, "Monto restante" = remainingBs, and an ENABLED "Continuar a elegir método" button', () => {
    const card: GiftCard = { id: 2, code: 'GC-2', amount: 0, balance: 2, state: 'available' }
    const onConsumedAmountChange = vi.fn()
    render(
      <GiftCardPaymentView
        {...baseProps({
          foundCard: card,
          hasSufficientBalance: false,
          consumedAmountUSD: 2,
          consumedAmountInput: '2',
          onConsumedAmountChange,
          remainingBs: 36
        })}
      />
    )

    expect(screen.getByText('Saldo de la tarjeta')).toBeInTheDocument()
    expect(screen.getByText('Saldo a consumir ($)')).toBeInTheDocument()
    const input = screen.getByLabelText('Saldo a consumir') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('2')
    expect(screen.getByText('Monto restante')).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Continuar a elegir método' })
    expect(button).toBeEnabled()

    // La advertencia de saldo insuficiente (Scenario 3) NO debe mostrarse aquí
    expect(screen.queryByText(/es menor que el total a pagar/i)).not.toBeInTheDocument()
  })
})

describe('GiftCardPaymentView — Scenario 1 (full balance, regression)', () => {
  it('keeps the "Confirmar consumo" button enabled and renders the Saldo a consumir ($) input', () => {
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    const onConsumedAmountChange = vi.fn()
    render(
      <GiftCardPaymentView
        {...baseProps({
          foundCard: card,
          hasSufficientBalance: true,
          consumedAmountUSD: ORDER_TOTAL_USD,
          consumedAmountInput: String(ORDER_TOTAL_USD),
          onConsumedAmountChange,
          remainingBs: 0
        })}
      />
    )

    expect(screen.getByText('Saldo a consumir ($)')).toBeInTheDocument()
    const input = screen.getByLabelText('Saldo a consumir') as HTMLInputElement
    expect(input.value).toBe('2.9')
    const button = screen.getByRole('button', { name: 'Confirmar consumo' })
    expect(button).toBeEnabled()
    expect(screen.queryByText('Monto restante')).not.toBeInTheDocument()
  })
})

describe('GiftCardPaymentView — Scenario 3 (zero/invalid balance, regression)', () => {
  it('keeps the original disabled/insufficient-balance markup, input is disabled', () => {
    const card: GiftCard = { id: 3, code: 'GC-3', amount: 0, balance: 0, state: 'available' }
    render(
      <GiftCardPaymentView
        {...baseProps({
          foundCard: card,
          hasSufficientBalance: false,
          consumedAmountUSD: 0,
          consumedAmountInput: '0',
          onConsumedAmountChange: vi.fn(),
          remainingBs: 0
        })}
      />
    )

    expect(screen.getByText(/es menor que el total a pagar/i)).toBeInTheDocument()
    const input = screen.getByLabelText('Saldo a consumir') as HTMLInputElement
    expect(input).toBeDisabled()
    const button = screen.getByRole('button', { name: 'Confirmar consumo' })
    expect(button).toBeDisabled()
    expect(screen.queryByText('Monto restante')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar a elegir método' })).not.toBeInTheDocument()
  })
})

