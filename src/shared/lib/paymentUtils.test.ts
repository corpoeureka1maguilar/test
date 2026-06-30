import { describe, it, expect } from 'vitest'
import { calcIgtf, getPaymentLabel, getPaymentFormFields } from './paymentUtils'
import type { KioskPaymentMethod } from '@/shared/types/types'

function makeMethod(overrides: Partial<KioskPaymentMethod> = {}): KioskPaymentMethod {
  return {
    id: 1,
    name: 'Tarjeta',
    paymentType: 'card',
    applyIgtf: false,
    igtfPercent: 0,
    journalId: 1,
    currencyId: 1,
    useForChange: false,
    ...overrides
  }
}

describe('calcIgtf', () => {
  it('returns 0 when the method does not apply IGTF', () => {
    expect(calcIgtf(makeMethod({ applyIgtf: false, igtfPercent: 3 }), 100)).toBe(0)
  })

  it('returns 0 when igtfPercent is 0 even if applyIgtf is true', () => {
    expect(calcIgtf(makeMethod({ applyIgtf: true, igtfPercent: 0 }), 100)).toBe(0)
  })

  it('calculates the IGTF amount over the base amount', () => {
    expect(calcIgtf(makeMethod({ applyIgtf: true, igtfPercent: 3 }), 100)).toBe(3)
  })

  it('calculates the IGTF amount with decimals', () => {
    expect(calcIgtf(makeMethod({ applyIgtf: true, igtfPercent: 3 }), 250.5)).toBeCloseTo(7.515, 3)
  })
})

describe('getPaymentLabel', () => {
  it('returns the Spanish label for a known payment type', () => {
    expect(getPaymentLabel('pago_movil')).toBe('Pago móvil')
  })
})

describe('getPaymentFormFields', () => {
  it('requires bank, phone and reference for pago_movil', () => {
    expect(getPaymentFormFields('pago_movil')).toEqual(['bank', 'phone', 'reference'])
  })

  it('requires bank and reference for transferencia', () => {
    expect(getPaymentFormFields('transferencia')).toEqual(['bank', 'reference'])
  })

  it('requires only reference for zelle', () => {
    expect(getPaymentFormFields('zelle')).toEqual(['reference'])
  })

  it('requires no extra fields for cash', () => {
    expect(getPaymentFormFields('cash')).toEqual([])
  })
})
