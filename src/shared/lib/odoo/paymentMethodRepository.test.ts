import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/lib/odooEnv', () => ({
  odooEnv: { callMethod: vi.fn() }
}))

import { odooEnv } from '@/shared/lib/odooEnv'
import { fetchPaymentMethods } from './paymentMethodRepository'

const callMethod = odooEnv.callMethod as ReturnType<typeof vi.fn>

beforeEach(() => {
  callMethod.mockReset()
})

describe('fetchPaymentMethods — printer_code (fiscal-tender-code-mapping)', () => {
  it('requests printer_code in the search_read fields list', async () => {
    callMethod.mockResolvedValueOnce([])

    await fetchPaymentMethods()

    expect(callMethod).toHaveBeenCalledWith(
      'x.pos.payment.method', 'search_read',
      [[['use_for_payment', '=', true], ['caja_autoservicio', '=', true], ['active', '=', true]]],
      { fields: expect.arrayContaining(['printer_code']) }
    )
  })

  it('maps printer_code: "05" to printerCode: "05"', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 1, name: 'Terminal Banesco', payment_type: 'card', apply_igtf: false, igtf_percent: 0, journal_id: [5, 'Banesco'], currency_id: false, use_for_change: false, with_merchant: true, printer_code: '05' }
    ])

    const methods = await fetchPaymentMethods()

    expect(methods[0]!.printerCode).toBe('05')
  })

  it('maps printer_code: false to printerCode: "" (no silent default other than empty string)', async () => {
    callMethod.mockResolvedValueOnce([
      { id: 2, name: 'Terminal sin codigo', payment_type: 'card', apply_igtf: false, igtf_percent: 0, journal_id: [6, 'Provincial'], currency_id: false, use_for_change: false, with_merchant: true, printer_code: false }
    ])

    const methods = await fetchPaymentMethods()

    expect(methods[0]!.printerCode).toBe('')
  })
})
