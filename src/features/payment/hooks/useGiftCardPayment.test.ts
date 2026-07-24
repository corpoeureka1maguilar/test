import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod, GiftCard } from '@/shared/types/types'

vi.mock('@/shared/lib/odooRepository', () => ({
  searchGiftCard: vi.fn()
}))

import { searchGiftCard } from '@/shared/lib/odooRepository'
import { useGiftCardPayment } from './useGiftCardPayment'

const searchGiftCardMock = searchGiftCard as ReturnType<typeof vi.fn>

// El método pasado al hook ES el método "Tarjeta de regalo" (id -999): la
// vista GiftCardPaymentView solo se monta cuando ya se seleccionó ese método
// (ver comentario original del hook).
const method: KioskPaymentMethod = {
  id: -999, name: 'Tarjeta de regalo', paymentType: 'otro', applyIgtf: false, igtfPercent: 0,
  journalId: 5, currencyId: 1, useForChange: false
}

// total = 116 Bs, globalRate = 40 -> orderTotalUSD = 2.9
const TOTAL_BS = 116
const GLOBAL_RATE = 40

function setup() {
  const send = vi.fn()
  const navigate = vi.fn() as unknown as NavigateFunction
  const pushToast = vi.fn()
  const { result } = renderHook(() => useGiftCardPayment({
    method,
    total: TOTAL_BS,
    globalRate: GLOBAL_RATE,
    send,
    navigate,
    pushToast
  }))
  return { result, send, navigate: navigate as unknown as ReturnType<typeof vi.fn>, pushToast }
}

async function findCard(result: ReturnType<typeof setup>['result'], card: GiftCard) {
  searchGiftCardMock.mockResolvedValue(card)
  act(() => { result.current.setGiftCardCode(card.code) })
  await act(async () => { await result.current.handleSearchCard() })
  await waitFor(() => expect(result.current.foundCard).toEqual(card))
}

beforeEach(() => { searchGiftCardMock.mockReset() })

describe('useGiftCardPayment — consumed/remaining math', () => {
  it('consumedAmountUSD = min(balance, orderTotalUSD) when balance >= total: consumedAmountUSD === orderTotalUSD', async () => {
    const { result } = setup()
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    await findCard(result, card)

    expect(result.current.consumedAmountUSD).toBe(2.9) // orderTotalUSD = 116/40
    expect(result.current.remainingBs).toBe(0)
  })

  it('consumedAmountUSD = min(balance, orderTotalUSD) when balance < total: consumedAmountUSD === balance, remainingBs = total - consumedAmountUSD * rate', async () => {
    const { result } = setup()
    const card: GiftCard = { id: 2, code: 'GC-2', amount: 0, balance: 2, state: 'available' }
    await findCard(result, card)

    expect(result.current.consumedAmountUSD).toBe(2) // balance(2) < orderTotalUSD(2.9)
    expect(result.current.remainingBs).toBe(36) // 116 - 2*40
  })
})

describe('useGiftCardPayment — custom consumed balance editing', () => {
  it('allows user to customize consumedAmountUSD lower than card balance, updating remainingBs', async () => {
    const { result } = setup()
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    await findCard(result, card)

    expect(result.current.consumedAmountUSD).toBe(2.9)
    expect(result.current.remainingBs).toBe(0)

    act(() => {
      result.current.handleConsumedAmountChange('1.5')
    })

    expect(result.current.consumedAmountInput).toBe('1.5')
    expect(result.current.consumedAmountUSD).toBe(1.5)
    expect(result.current.remainingBs).toBe(116 - 1.5 * 40) // 116 - 60 = 56
    expect(result.current.hasSufficientBalance).toBe(false)
  })

  it('clamps custom input to maxConsumableUSD when user enters an amount higher than allowed', async () => {
    const { result } = setup()
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    await findCard(result, card)

    act(() => {
      result.current.handleConsumedAmountChange('5.0')
    })

    // orderTotalUSD is 2.9, max allowed is 2.9
    expect(result.current.consumedAmountInput).toBe('2.9')
    expect(result.current.consumedAmountUSD).toBe(2.9)
  })

  it('dispatches GIFT_CARD_PARTIAL when custom consumed amount is lower than orderTotalUSD', async () => {
    const { result, send, navigate } = setup()
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    await findCard(result, card)

    act(() => {
      result.current.handleConsumedAmountChange('1.0')
    })

    act(() => {
      result.current.handleGiftCardSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(send).toHaveBeenCalledTimes(1)
    const event = send.mock.calls[0]![0]
    expect(event.type).toBe('GIFT_CARD_PARTIAL')
    expect(event.giftCard).toEqual({ id: 1, code: 'GC-1', amount: 1, balance: 10, state: 'available' })
    expect(event.remainingAmount).toBe(76) // 116 - 40
    expect(navigate).toHaveBeenCalledWith('/pago')
  })
})

describe('useGiftCardPayment — submit dispatch', () => {
  it('balance >= total: dispatches a FULL SUBMIT_PAYMENT (method -999), no GIFT_CARD_PARTIAL, no navigation to /pago (regression, Scenario 1)', async () => {
    const { result, send, navigate } = setup()
    const card: GiftCard = { id: 1, code: 'GC-1', amount: 0, balance: 10, state: 'available' }
    await findCard(result, card)

    act(() => {
      result.current.handleGiftCardSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(send).toHaveBeenCalledTimes(1)
    const event = send.mock.calls[0]![0]
    expect(event.type).toBe('SUBMIT_PAYMENT')
    expect(event.payment.methodId).toBe(-999)
    expect(event.giftCard).toEqual({ id: 1, code: 'GC-1', amount: 2.9, balance: 10, state: 'available' })
    expect(navigate).not.toHaveBeenCalledWith('/pago')
  })

  it('0 < balance < total: dispatches GIFT_CARD_PARTIAL with giftCard.amount = consumedAmountUSD and remainingAmount = remainingBs, navigates to /pago, no insufficient-balance toast (Scenario 2)', async () => {
    const { result, send, navigate, pushToast } = setup()
    const card: GiftCard = { id: 2, code: 'GC-2', amount: 0, balance: 2, state: 'available' }
    await findCard(result, card)

    act(() => {
      result.current.handleGiftCardSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(pushToast).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    const event = send.mock.calls[0]![0]
    expect(event.type).toBe('GIFT_CARD_PARTIAL')
    expect(event.giftCard).toEqual({ id: 2, code: 'GC-2', amount: 2, balance: 2, state: 'available' })
    expect(event.remainingAmount).toBe(36)
    expect(navigate).toHaveBeenCalledWith('/pago')
  })

  it('balance === 0: keeps the existing hard-block error path, no dispatch (regression, Scenario 3)', async () => {
    const { result, send, navigate, pushToast } = setup()
    const card: GiftCard = { id: 3, code: 'GC-3', amount: 0, balance: 0, state: 'available' }
    await findCard(result, card)

    act(() => {
      result.current.handleGiftCardSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(pushToast).toHaveBeenCalledWith('error', 'El saldo de la tarjeta es insuficiente.')
    expect(send).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})

