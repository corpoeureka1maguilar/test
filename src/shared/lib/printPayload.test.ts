import { describe, it, expect } from 'vitest'
import { sanitize, buildFacturaPayload, buildNotaCreditoPayload, GIFT_CARD_TENDER_CODE } from './printPayload'
import { calcIgtf } from './paymentUtils'
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

describe('buildFacturaPayload — single tender (regression, pre-generalization contract)', () => {
  it('builds the partner, totals and item lines from the cart', () => {
    const payload = buildFacturaPayload(
      'María Pérez',
      'V-12345678',
      [{ name: 'Producto A', qty: 2, price: 50, taxRate: 0.16 }],
      [{ code: '01', amountBs: 100, igtfBs: 0 }]
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
      [{ code: '01', amountBs: 10, igtfBs: 0 }]
    )
    expect(payload.Items).toHaveLength(1)
    expect(payload.Items[0]!.descripcion).toBe('A')
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
      [{ code: '01', amountBs: 40, igtfBs: 0 }]
    )
    expect(payload.Items.map(i => i.tasa)).toEqual(['2', '3', '1', '1'])
  })

  it('includes the IGTF amount in montoigtf when the tender carries one (calcIgtf, never hardcoded)', () => {
    const igtfMethod: KioskPaymentMethod = {
      id: 1, name: 'Efectivo', paymentType: 'cash', applyIgtf: true, igtfPercent: 3,
      journalId: 1, currencyId: 1, useForChange: false
    }
    const igtfBs = calcIgtf(igtfMethod, 100)
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 100 }],
      [{ code: '01', amountBs: 100, igtfBs }]
    )
    expect(payload.montoigtf).toBe('300')
  })
})

describe('buildFacturaPayload — tenders[] generalization (generic-partial-payment / fiscal-tender-code-mapping)', () => {
  it('two legs with distinct real printerCodes produce two separate pago<code> lines — never pago01/pago15 hardcoded for both', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 80 }],
      [
        { code: '05', amountBs: 50, igtfBs: 0 },
        { code: '07', amountBs: 30, igtfBs: 0 }
      ]
    )
    expect(payload['pago05']).toBe('5000')
    expect(payload['pago07']).toBe('3000')
    expect(payload).not.toHaveProperty('pago01')
    expect(payload).not.toHaveProperty('pago15')
  })

  it('two legs sharing the same printerCode accumulate into one tender line instead of the last write winning', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 80 }],
      [
        { code: '05', amountBs: 20, igtfBs: 0 },
        { code: '05', amountBs: 60, igtfBs: 0 }
      ]
    )
    expect(payload['pago05']).toBe('8000')
  })

  it('a tender with empty/falsy printerCode throws instead of silently defaulting to a code', () => {
    expect(() => buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 50 }],
      [{ code: '', amountBs: 50, igtfBs: 0 }]
    )).toThrow()
  })

  it('a gift-card tender (fixed GIFT_CARD_TENDER_CODE) coexists with a real-printerCode tender, each on its own line, summing to the order total', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 116 }],
      [
        { code: GIFT_CARD_TENDER_CODE, amountBs: 80, igtfBs: 0 },
        { code: '05', amountBs: 36, igtfBs: 0 }
      ]
    )
    expect(payload['pago15']).toBe('8000')
    expect(payload['pago05']).toBe('3600')

    const pago15 = Number(payload['pago15']) / 100
    const pago05 = Number(payload['pago05']) / 100
    expect(pago15 + pago05).toBe(116)
  })

  it('montoigtf is the sum of every tender\'s igtfBs, not just the first tender\'s', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 100 }],
      [
        { code: '05', amountBs: 50, igtfBs: 1.5 },
        { code: '07', amountBs: 50, igtfBs: 0.75 }
      ]
    )
    expect(payload.montoigtf).toBe('225') // (1.5 + 0.75) * 100
  })

  it('regression: a single-tender sale (today\'s shipped shape) produces a byte-identical payload to the pre-generalization contract', () => {
    const payload = buildFacturaPayload(
      'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 100 }],
      [{ code: '01', amountBs: 100, igtfBs: 0 }]
    )
    expect(payload.montoigtf).toBe('0')
    expect(payload['pago01']).toBe('10000')
    expect(payload).not.toHaveProperty('pago15')
  })
})

describe('buildNotaCreditoPayload', () => {
  const method: KioskPaymentMethod = {
    id: 1, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
    journalId: 1, currencyId: 1, useForChange: false
  }

  const build = (invoiceNumber?: string, maquina?: string) =>
    buildNotaCreditoPayload(
      invoiceNumber,
      '01072026',
      '1430',
      'María Pérez',
      'V-12345678',
      [{ name: 'Producto A', qty: 2, price: 50, taxRate: 0.16 }],
      method,
      100,
      maquina
    )

  it('references the original invoice: number padded to 7 digits, date, time and machine serial', () => {
    const payload = build('1234', 'Z1B1234567')

    expect(payload.factura).toBe('0001234')
    expect(payload.fecha).toBe('01072026')
    expect(payload.hora).toBe('1430')
    expect(payload.maquina).toBe('Z1B1234567')
  })

  it('normalizes numeric invoice numbers with leading zeros like the reprint flow', () => {
    expect(build('00001234').factura).toBe('0001234')
  })

  it('falls back to all zeros when the order has no fiscal invoice number', () => {
    const payload = build(undefined)
    expect(payload.factura).toBe('0000000')
    expect(payload.maquina).toBe('')
  })

  // Paridad con fex (eu_fex_ppal print.ts _getReturnInvoicePrint): la nota de
  // crédito no reporta caja de origen, la clave se elimina del payload en vez
  // de mandarse vacía — el agente de impresión rechaza payloads con caja: ""
  it('does not include the caja key at all, like fex does for notas de crédito', () => {
    const payload = build('1234')
    expect(payload).not.toHaveProperty('caja')
  })

  it('exposes the lines as ItemsNota (not Items) and forces montoigtf to zero', () => {
    const payload = build('1234')

    expect(payload.ItemsNota).toEqual([{
      codigo: '', descripcion: 'Producto A', impuesto: '1', tasa: '1', cantidad: '2000', precio: '5000', descuentop: '0'
    }])
    expect(payload).not.toHaveProperty('Items')
    expect(payload.montoigtf).toBe('0')
    expect(payload['pago01']).toBe('10000')
  })

  it('uses the fixed gift-card tender code when the original method.id === -999, even without a real printerCode', () => {
    const giftCardMethod: KioskPaymentMethod = { ...method, id: -999 }
    const payload = buildNotaCreditoPayload(
      '1234', '01072026', '1430', 'Juan', 'V-1',
      [{ name: 'A', qty: 1, price: 50 }],
      giftCardMethod,
      100
    )
    expect(payload['pago15']).toBe('10000')
  })
})
