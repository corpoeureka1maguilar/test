import { describe, it, expect } from 'vitest'
import { calcIgtf, getPaymentLabel, getPaymentFormFields, isValidVenezuelanPhone, formatPhone, matchBarcode, matchBarcodeIncludes } from './paymentUtils'
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

describe('isValidVenezuelanPhone', () => {
  it('validates correct formats', () => {
    expect(isValidVenezuelanPhone('0414-1234567')).toBe(true)
    expect(isValidVenezuelanPhone('04121234567')).toBe(true)
    expect(isValidVenezuelanPhone('0424 123 4567')).toBe(true)
    expect(isValidVenezuelanPhone('584161234567')).toBe(true)
    expect(isValidVenezuelanPhone('4261234567')).toBe(true)
    expect(isValidVenezuelanPhone('02121234567')).toBe(true)
    expect(isValidVenezuelanPhone('04221234567')).toBe(true)
    expect(isValidVenezuelanPhone('02551234567')).toBe(true)
    expect(isValidVenezuelanPhone('+57 310 1234567')).toBe(true)
    expect(isValidVenezuelanPhone('+13051234567')).toBe(true)
  })

  it('invalidates wrong formats', () => {
    expect(isValidVenezuelanPhone('123456')).toBe(false)
    expect(isValidVenezuelanPhone('0414-123456')).toBe(false)
    expect(isValidVenezuelanPhone('05121234567')).toBe(false)
    expect(isValidVenezuelanPhone('0414-12345678')).toBe(false)
    expect(isValidVenezuelanPhone('+123')).toBe(false)
    expect(isValidVenezuelanPhone('+1234567890123456')).toBe(false)
  })
})

describe('matchBarcode', () => {
  it('matches single barcode', () => {
    expect(matchBarcode('123456', '123456')).toBe(true)
    expect(matchBarcode('123456', ' 123456 ')).toBe(true)
    expect(matchBarcode('123456', '999999')).toBe(false)
  })

  it('matches multiple barcodes with different separators', () => {
    expect(matchBarcode('123,456,789', '456')).toBe(true)
    expect(matchBarcode('123; 456 | 789', '789')).toBe(true)
    expect(matchBarcode('123 456', '123')).toBe(true)
    expect(matchBarcode('123,456', '999')).toBe(false)
  })
})

describe('matchBarcodeIncludes', () => {
  it('matches partially inside multiple barcodes', () => {
    expect(matchBarcodeIncludes('123456, 789012', '456')).toBe(true)
    expect(matchBarcodeIncludes('123456, 789012', '7890')).toBe(true)
    expect(matchBarcodeIncludes('123456, 789012', '999')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('formats Venezuelan numbers with hyphens', () => {
    expect(formatPhone('04261234567')).toBe('0426-1234-567')
    expect(formatPhone('0412123')).toBe('0412-123')
    expect(formatPhone('04121234')).toBe('0412-1234')
    expect(formatPhone('041212345')).toBe('0412-1234-5')
  })

  it('keeps international numbers raw', () => {
    expect(formatPhone('+573101234567')).toBe('+573101234567')
  })
})
