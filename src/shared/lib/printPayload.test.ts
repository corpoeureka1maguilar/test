import { describe, it, expect } from 'vitest'
import { sanitize, buildFacturaPayload } from './printPayload'
import type { KioskPaymentMethod } from '@/shared/types/types'

describe('sanitize', () => {
  it('strips accented vowels and ñ to their plain ASCII equivalents', () => {
    expect(sanitize('Peña Núñez')).toBe('Pena Nunez')
  })

  it('removes characters outside the allowed set', () => {
    expect(sanitize('Café #1 @ "Centro"')).toBe('Cafe 1  Centro')
  })

  it('keeps allowed punctuation: brackets, slash, ampersand, pipe, comma, dot, underscore, plus, hyphen', () => {
    expect(sanitize('A[1]/B&C|D,E.F_G+H-I')).toBe('A[1]/B&C|D,E.F_G+H-I')
  })

  it('truncates to 100 characters', () => {
    const long = 'x'.repeat(150)
    expect(sanitize(long)).toHaveLength(100)
  })
})

describe('buildFacturaPayload', () => {
  const method: KioskPaymentMethod = {
    id: 1, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
    journalId: 1, currencyId: 1, useForChange: false
  }

  it('builds the partner, totals and item lines from the cart', () => {
    const payload = buildFacturaPayload(
      'María Pérez',
      'V-12345678',
      [{ name: 'Producto A', qty: 2, price: 50, taxRate: 0.16 }],
      method,
      100
    )

    expect(payload.nombre).toBe('Maria Perez')
    expect(payload.rif).toBe('V-12345678')
    expect(payload.Items).toEqual([{
      codigo: '', descripcion: 'Producto A', impuesto: '1', tasa: '1', cantidad: '2000', precio: '5000', descuentop: '0'
    }])
    expect(payload.montoigtf).toBe('0')
    expect(payload['pago01']).toBe('10000')
  })

  it('filters out lines with zero or negative quantity', () => {
    const payload = buildFacturaPayload(
      'Juan',
      'V-1',
      [{ name: 'A', qty: 1, price: 10 }, { name: 'B', qty: 0, price: 5 }],
      method,
      10
    )
    expect(payload.Items).toHaveLength(1)
    expect(payload.Items[0].descripcion).toBe('A')
  })

  it('maps known tax rates to their printer tax code and falls back to "1" otherwise', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [
        { name: 'A', qty: 1, price: 10, taxRate: 0.08 },
        { name: 'B', qty: 1, price: 10, taxRate: 0.31 },
        { name: 'C', qty: 1, price: 10, taxRate: 0.5 },
        { name: 'D', qty: 1, price: 10 }
      ],
      method,
      40
    )
    expect(payload.Items.map(i => i.tasa)).toEqual(['2', '3', '1', '1'])
  })

  it('includes the IGTF amount in montoigtf when the method applies it', () => {
    const igtfMethod: KioskPaymentMethod = { ...method, applyIgtf: true, igtfPercent: 3 }
    const payload = buildFacturaPayload('Juan', 'V-1', [{ name: 'A', qty: 1, price: 100 }], igtfMethod, 100)
    expect(payload.montoigtf).toBe('300')
  })
})
