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
  fetchCashier,
  checkKioskAdmin,
  KIOSK_OPERATIONS
} from './odooRepository'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

const callMethod = odooEnv.callMethod as ReturnType<typeof vi.fn>

beforeEach(() => {
  callMethod.mockReset()
})

describe('searchPartnerByCedula', () => {
  it('maps the found partner and converts false phone/street to undefined', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 1, name: 'Juan Perez', cedula: 'V-12345678', phone: false, street: 'Av. Principal', email: false }
    ])
    const partner = await searchPartnerByCedula('V-12345678')
    expect(partner).toEqual({ id: 1, name: 'Juan Perez', cedula: 'V-12345678', phone: undefined, street: 'Av. Principal', email: undefined })
  })

  it('returns null when no partner matches', async () => {
    callMethod.mockResolvedValueOnce([])
    expect(await searchPartnerByCedula('V-00000000')).toBeNull()
  })
})

describe('createPartner', () => {
  it('creates the partner and reads it back mapped', async () => {
    callMethod.mockResolvedValueOnce(99)
    callMethod.mockResolvedValueOnce([{ id: 99, name: 'Ana Gomez', cedula: 'V-1111', phone: false, street: false, email: false }])

    const partner = await createPartner({ name: 'Ana Gomez', cedula: 'V-1111' })

    expect(partner).toEqual({ id: 99, name: 'Ana Gomez', cedula: 'V-1111', phone: undefined, street: undefined, email: undefined })
    expect(callMethod).toHaveBeenNthCalledWith(
      1, 'res.partner', 'create',
      [{ name: 'Ana Gomez', cedula: 'V-1111', phone: false, street: false, email: false }]
    )
  })
})

describe('fetchPaymentMethods', () => {
  it('maps payment methods and enriches them with currency info', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Efectivo', payment_type: 'cash', apply_igtf: false, igtf_percent: 0, journal_id: [5, 'Caja'], currency_id: [2, 'USD'], use_for_change: true, with_merchant: false }
      ])
      .mockResolvedValueOnce([{ id: 2, name: 'USD', symbol: '$', rate: 36.5 }])

    const methods = await fetchPaymentMethods()

    expect(callMethod).toHaveBeenCalledWith(
      'x.pos.payment.method', 'search_read',
      [[['use_for_payment', '=', true], ['caja_autoservicio', '=', true], ['active', '=', true]]],
      { fields: ['id', 'name', 'payment_type', 'apply_igtf', 'igtf_percent', 'journal_id', 'currency_id', 'use_for_change', 'with_merchant'] }
    )

    expect(methods).toEqual([{
      id: 1, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
      journalId: 5, currencyId: 2, useForChange: true, withMerchant: false,
      currencyName: 'USD', currencySymbol: '$', currencyRate: 36.5
    }])
  })

  it('filters by branch (own branch or global methods) when a branchId is provided', async () => {
    callMethod.mockResolvedValueOnce([])

    await fetchPaymentMethods(7)

    expect(callMethod).toHaveBeenCalledWith(
      'x.pos.payment.method', 'search_read',
      [[
        ['use_for_payment', '=', true],
        ['caja_autoservicio', '=', true],
        ['active', '=', true],
        '|', ['branch_id', '=', 7], ['branch_id', '=', false]
      ]],
      { fields: ['id', 'name', 'payment_type', 'apply_igtf', 'igtf_percent', 'journal_id', 'currency_id', 'use_for_change', 'with_merchant'] }
    )
  })

  it('maps a method with no currency_id to currencyId 0 and skips the currency lookup', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 3, name: 'Otro', payment_type: 'otro', apply_igtf: false, igtf_percent: 0, journal_id: [1, 'Caja'], currency_id: false, use_for_change: false, with_merchant: false }
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
      .mockResolvedValueOnce([])

    const products = await fetchProducts()

    expect(products).toEqual([{
      id: 1, name: 'Producto A', defaultCode: 'P-A', barcode: undefined,
      price: 360, priceUsd: 10, taxRate: 0.16,
      categId: 1, categName: 'General', uomName: 'Unidad', isGiftCard: false
    }])
    expect(useExchangeRateStore.getState().rate).toBe(36)
  })

  it('falls back to a rate of 1 (no markup) when the currency rate lookup fails', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 2, name: 'Producto B', default_code: false, barcode: false, list_price: 20, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockRejectedValueOnce(new Error('rate unavailable'))
      .mockResolvedValueOnce([])

    const products = await fetchProducts()

    expect(products[0].price).toBe(20)
    expect(products[0].taxRate).toBe(0.16)
  })

  it('fetches branch fixed products by id when the catalog domain left them out', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Producto A', default_code: 'P-A', barcode: false, list_price: 10, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([
        { id: 50, name: 'Bolsa', default_code: 'BOLSA', barcode: false, list_price: 0.5, taxes_id: [], categ_id: [2, 'Empaque'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce([])

    const products = await fetchProducts([50])

    expect(callMethod).toHaveBeenCalledWith(
      'product.product', 'search_read',
      [[['id', 'in', [50]]]],
      { fields: ['id', 'name', 'default_code', 'barcode', 'list_price', 'taxes_id', 'categ_id', 'uom_id'] }
    )
    expect(products.map(p => p.id)).toEqual([1, 50])
  })

  it('does not re-fetch fixed products already present in the catalog result', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Producto A', default_code: 'P-A', barcode: false, list_price: 10, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([])

    const products = await fetchProducts([1])

    expect(products).toHaveLength(1)
    // 1: catálogo, 2: tasa de cambio, 3: códigos de barra secundarios — sin llamada extra por fijos
    expect(callMethod).toHaveBeenCalledTimes(3)
  })

  it('merges secondary barcodes (product.barcode.multi) into the product barcode string', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Producto A', default_code: 'P-A', barcode: '111', list_price: 10, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([
        { product_id: [1, 'Producto A'], name: '222' },
        { product_id: [1, 'Producto A'], name: '333' }
      ])

    const products = await fetchProducts()

    expect(callMethod).toHaveBeenCalledWith(
      'product.barcode.multi', 'search_read',
      [[['product_id', 'in', [1]]]],
      { fields: ['product_id', 'name'] }
    )
    expect(products[0].barcode).toBe('111,222,333')
  })

  it('uses only the secondary barcodes when the product has no main barcode', async () => {
    callMethod
      .mockResolvedValueOnce([
        { id: 1, name: 'Producto A', default_code: 'P-A', barcode: false, list_price: 10, taxes_id: [], categ_id: [1, 'General'], uom_id: [1, 'Unidad'] }
      ])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([{ product_id: [1, 'Producto A'], name: '222' }])

    const products = await fetchProducts()

    expect(products[0].barcode).toBe('222')
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

describe('checkKioskAdmin', () => {
  it('calls action_check_kiosk_admin with the operation ref, branch, session and message', async () => {
    callMethod.mockResolvedValueOnce({ ok: true, approverCashierId: 5, approverName: 'Admin' })

    const res = await checkKioskAdmin('1234', KIOSK_OPERATIONS.saleReturn, 7, 42, 'Devolución SO001')

    expect(callMethod).toHaveBeenCalledWith(
      'x.pos.cashier', 'action_check_kiosk_admin',
      ['1234', 'eu_pos_permission_levels.x_pos_audit_sale_return', 7, 42, 'Devolución SO001']
    )
    expect(res.ok).toBe(true)
  })

  it('propagates the backend error code when the check fails', async () => {
    callMethod.mockResolvedValueOnce({ ok: false, error: 'no_allowed' })
    const res = await checkKioskAdmin('1234', KIOSK_OPERATIONS.openSession, 7)
    expect(res).toEqual({ ok: false, error: 'no_allowed' })
  })
})
