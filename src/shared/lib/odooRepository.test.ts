import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/lib/odooEnv', () => ({
  odooEnv: { callMethod: vi.fn() }
}))

import { odooEnv } from '@/shared/lib/odooEnv'
import {
  searchPartnerByCedula,
  createPartner,
  fetchPaymentMethods,
  fetchProducts,
  createSaleOrder,
  fetchActiveSession,
  openOdooSession,
  closeOdooSession,
  fetchCashier
} from './odooRepository'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

const callMethod = odooEnv.callMethod as ReturnType<typeof vi.fn>

beforeEach(() => {
  callMethod.mockReset()
})

describe('searchPartnerByCedula', () => {
  it('maps the found partner and converts false phone/street to undefined', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 1, name: 'Juan Perez', cedula: 'V-12345678', phone: false, street: 'Av. Principal' }
    ])
    const partner = await searchPartnerByCedula('V-12345678')
    expect(partner).toEqual({ id: 1, name: 'Juan Perez', cedula: 'V-12345678', phone: undefined, street: 'Av. Principal' })
  })

  it('returns null when no partner matches', async () => {
    callMethod.mockResolvedValueOnce([])
    expect(await searchPartnerByCedula('V-00000000')).toBeNull()
  })
})

describe('createPartner', () => {
  it('creates the partner and reads it back mapped', async () => {
    callMethod.mockResolvedValueOnce(99)
    callMethod.mockResolvedValueOnce([{ id: 99, name: 'Ana Gomez', cedula: 'V-1111', phone: false, street: false }])

    const partner = await createPartner({ name: 'Ana Gomez', cedula: 'V-1111' })

    expect(partner).toEqual({ id: 99, name: 'Ana Gomez', cedula: 'V-1111', phone: undefined, street: undefined })
    expect(callMethod).toHaveBeenNthCalledWith(
      1, 'res.partner', 'create',
      [{ name: 'Ana Gomez', cedula: 'V-1111', phone: false, street: false }]
    )
  })
})

describe('fetchPaymentMethods', () => {
  it('maps payment methods and enriches them with currency info', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Efectivo', payment_type: 'cash', apply_igtf: false, igtf_percent: 0, journal_id: [5, 'Caja'], currency_id: [2, 'USD'], use_for_change: true }
      ])
      .mockResolvedValueOnce([{ id: 2, name: 'USD', symbol: '$', rate: 36.5 }])

    const methods = await fetchPaymentMethods()

    expect(methods).toEqual([{
      id: 1, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
      journalId: 5, currencyId: 2, useForChange: true,
      currencyName: 'USD', currencySymbol: '$', currencyRate: 36.5
    }])
  })

  it('maps a method with no currency_id to currencyId 0 and skips the currency lookup', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 3, name: 'Otro', payment_type: 'otro', apply_igtf: false, igtf_percent: 0, journal_id: [1, 'Caja'], currency_id: false, use_for_change: false }
    ])

    const methods = await fetchPaymentMethods()

    expect(methods[0].currencyId).toBe(0)
    expect(callMethod).toHaveBeenCalledTimes(1)
  })
})

describe('fetchProducts', () => {
  it('applies the exchange rate to price while keeping priceUsd at list price, and persists the rate', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Producto A', default_code: 'P-A', barcode: false, list_price: 10, taxes_id: [7], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce(36)
      .mockResolvedValueOnce([{ id: 7, amount: 16 }])

    const products = await fetchProducts()

    expect(products).toEqual([{
      id: 1, name: 'Producto A', defaultCode: 'P-A', barcode: undefined,
      price: 360, priceUsd: 10, taxRate: 0.16,
      categId: 1, categName: 'General', uomName: 'Unidad'
    }])
    expect(useExchangeRateStore.getState().rate).toBe(36)
  })

  it('falls back to a rate of 1 (no markup) when the currency rate lookup fails', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 2, name: 'Producto B', default_code: false, barcode: false, list_price: 20, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockRejectedValueOnce(new Error('rate unavailable'))

    const products = await fetchProducts()

    expect(products[0].price).toBe(20)
    expect(products[0].taxRate).toBe(0.16)
  })
})

describe('createSaleOrder', () => {
  it('forwards the payload to action_create_sale_order_from_pos', async () => {
    callMethod.mockResolvedValueOnce({ ok: true })
    const result = await createSaleOrder({ id: 'abc' })
    expect(result).toEqual({ ok: true })
    expect(callMethod).toHaveBeenCalledWith('sale.order', 'action_create_sale_order_from_pos', [{ id: 'abc' }])
  })
})

describe('session and cashier flow', () => {
  it('fetchActiveSession returns the active session when one exists', async () => {
    callMethod.mockResolvedValueOnce([{ id: 5, opening_date: '2026-06-30 08:00:00' }])
    expect(await fetchActiveSession(1)).toEqual({ id: 5, openingDate: '2026-06-30 08:00:00' })
  })

  it('fetchActiveSession returns null when there is no active session', async () => {
    callMethod.mockResolvedValueOnce([])
    expect(await fetchActiveSession(1)).toBeNull()
  })

  it('openOdooSession throws when Odoo does not return a session id', async () => {
    callMethod.mockResolvedValueOnce(0)
    await expect(openOdooSession(1, 2)).rejects.toThrow('No se pudo aperturar la sesión en Odoo')
  })

  it('openOdooSession sets the active cashier after creating the session', async () => {
    callMethod.mockResolvedValueOnce(10).mockResolvedValueOnce(true)
    const sessionId = await openOdooSession(1, 2)
    expect(sessionId).toBe(10)
    expect(callMethod).toHaveBeenNthCalledWith(2, 'x.pos.session', 'action_set_active_cashier', [10, 2, '1.0.0'])
  })

  it('closeOdooSession calls action_close_session with the session id', async () => {
    callMethod.mockResolvedValueOnce(true)
    await closeOdooSession(10)
    expect(callMethod).toHaveBeenCalledWith('x.pos.session', 'action_close_session', [10])
  })

  it('fetchCashier returns null when Odoo finds no cashier for the user', async () => {
    callMethod.mockResolvedValueOnce(null)
    expect(await fetchCashier(1, 1)).toBeNull()
  })

  it('fetchCashier maps the cashier when found', async () => {
    callMethod.mockResolvedValueOnce({ cashierId: 9, name: 'Cajero Kiosco' })
    expect(await fetchCashier(1, 1)).toEqual({ id: 9, name: 'Cajero Kiosco' })
  })
})
