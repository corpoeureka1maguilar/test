import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'
import type { SaleContext } from '@/features/payment/machines/saleMachine'
import { useVposCheckout } from './useVposCheckout'

// generic-partial-payment / payment-flow "VPOS Charge as Intermediate Leg":
// un cobro VPOS confirmado (codRespuesta === '00') SIEMPRE dispara
// VPOS_LEG_PAID — nunca SUBMIT_PAYMENT (ese evento queda solo para el path
// legacy no-VPOS/full-gift-card, ver saleMachine.ts 0.1) — y el monto de la
// pierna (`baseBs`) es el monto CONFIRMADO por el cajero (nuevo param
// `confirmedBaseBs`), nunca `remainingAmount`/`total` a ciegas.

const method: KioskPaymentMethod = {
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

function baseContext(overrides: Partial<SaleContext> = {}): SaleContext {
  return {
    customer: null,
    pendingVat: null,
    cart: [],
    requiredEngines: [],
    selectedMethod: method,
    activePayment: null,
    giftCard: null,
    giftCardLeg: null,
    remainingAmount: null,
    legs: [],
    saleAttemptId: 'attempt-1',
    odooOrderId: null,
    queuedOffline: false,
    printerResult: null,
    errorMessage: null,
    printError: null,
    countdown: 0,
    ...overrides
  }
}

function setup(overrides: Partial<Parameters<typeof useVposCheckout>[0]> = {}) {
  const send = vi.fn()
  const navigate = vi.fn() as unknown as NavigateFunction
  const pushToast = vi.fn()
  const params = {
    method,
    context: baseContext(),
    totalWithIgtfBs: 50,
    paymentAmount: 50,
    paymentIgtf: 0,
    confirmedBaseBs: 50,
    send,
    navigate,
    pushToast,
    ...overrides
  }
  const { result, rerender } = renderHook((props: typeof params) => useVposCheckout(props), {
    initialProps: params
  })
  return { result, rerender, send, navigate: navigate as unknown as ReturnType<typeof vi.fn>, pushToast, params }
}

function fireVposMessage(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVposCheckout — dispatch shape on codRespuesta === 00', () => {
  it('dispatches VPOS_LEG_PAID (never SUBMIT_PAYMENT) with baseBs = confirmedBaseBs, not totalWithIgtfBs/remainingAmount blindly', async () => {
    const { result, send } = setup({
      context: baseContext({ remainingAmount: 100 }),
      totalWithIgtfBs: 100,
      confirmedBaseBs: 30 // cajero confirmó un split parcial de 30, distinto del remanente (100)
    })
    await waitFor(() => expect(result.current.vposStatus).toBe('waiting'))

    act(() => {
      fireVposMessage({ codRespuesta: '00', numeroReferencia: 'REF-1' })
    })

    expect(send).toHaveBeenCalledTimes(1)
    const event = send.mock.calls[0]![0]
    expect(event.type).toBe('VPOS_LEG_PAID')
    expect(event.type).not.toBe('SUBMIT_PAYMENT')
    expect(event.method).toBe(method)
    expect(event.baseBs).toBe(30)
    expect(event.payment.reference).toBe('REF-1')
  })

  it('never dispatches SUBMIT_PAYMENT on approval', async () => {
    const { result, send } = setup()
    await waitFor(() => expect(result.current.vposStatus).toBe('waiting'))

    act(() => {
      fireVposMessage({ codRespuesta: '00', numeroReferencia: 'REF-2' })
    })

    expect(send.mock.calls.every((call) => call[0].type !== 'SUBMIT_PAYMENT')).toBe(true)
  })
})

describe('useVposCheckout — navigation depends on whether the confirmed amount covers the remainder', () => {
  it('navigates to /resultado when confirmedBaseBs >= remainingAmount (closes the sale)', async () => {
    const { result, navigate } = setup({
      context: baseContext({ remainingAmount: 30 }),
      confirmedBaseBs: 30
    })
    await waitFor(() => expect(result.current.vposStatus).toBe('waiting'))

    act(() => {
      fireVposMessage({ codRespuesta: '00', numeroReferencia: 'REF-3' })
    })

    expect(navigate).toHaveBeenCalledWith('/resultado')
  })

  it('navigates to /pago (loop, no close) when confirmedBaseBs < remainingAmount, without discarding prior legs', async () => {
    const { result, navigate, send } = setup({
      context: baseContext({ remainingAmount: 100 }),
      confirmedBaseBs: 30
    })
    await waitFor(() => expect(result.current.vposStatus).toBe('waiting'))

    act(() => {
      fireVposMessage({ codRespuesta: '00', numeroReferencia: 'REF-4' })
    })

    expect(navigate).toHaveBeenCalledWith('/pago')
    expect(navigate).not.toHaveBeenCalledWith('/resultado')
    // el loop no dispara ningún evento que descarte legs (BACK/RESET) — solo VPOS_LEG_PAID
    expect(send.mock.calls.every((call) => ['VPOS_LEG_PAID'].includes(call[0].type))).toBe(true)
  })

  it('when remainingAmount is null (first/only VPOS leg, no gift card), falls back to totalWithIgtfBs to decide closing — regression: single VPOS-only sale closes', async () => {
    const { result, navigate } = setup({
      context: baseContext({ remainingAmount: null }),
      totalWithIgtfBs: 50,
      confirmedBaseBs: 50
    })
    await waitFor(() => expect(result.current.vposStatus).toBe('waiting'))

    act(() => {
      fireVposMessage({ codRespuesta: '00', numeroReferencia: 'REF-5' })
    })

    expect(navigate).toHaveBeenCalledWith('/resultado')
  })
})

// generic-partial-payment (task 3.4): el ping/iframe VPOS no debe arrancar
// hasta que el cajero confirme el monto de la pierna en VposAmountInput
// (Fase 3.3/3.4). Nuevo param opcional `confirmed` (default `true` — cambio
// retrocompatible, ver Deviation en tasks.md 3.4) gatea el efecto.
describe('useVposCheckout — ping effect gated on confirmed (generic-partial-payment 3.4, VposAmountInput)', () => {
  it('does not ping the VPOS terminal when confirmed=false', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    setup({ confirmed: false })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('pings the VPOS terminal once confirmed becomes true (rerender after VposAmountInput confirms)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const { rerender, params } = setup({ confirmed: false })
    expect(fetchSpy).not.toHaveBeenCalled()

    rerender({ ...params, confirmed: true })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
  })

  it('defaults to confirmed=true (backward compatible) when the param is omitted — existing behavior unchanged', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    setup()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
  })
})
