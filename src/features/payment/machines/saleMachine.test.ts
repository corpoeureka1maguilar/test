import { describe, it, expect, vi } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { saleMachine } from './saleMachine'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData } from '@/shared/types/types'

const submitPaymentRejecting = fromPromise<unknown, { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod }>(
  async () => { throw new Error('Odoo no disponible') }
)
const submitPaymentResolving = fromPromise<unknown, { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod }>(
  async () => ({ ok: true })
)
const printResolving = fromPromise<PrinterInvoiceData, { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string }>(
  async () => ({ code: '001', date: '2026-06-30 10:00', serial: 'A1' })
)
const printRejecting = fromPromise<PrinterInvoiceData, { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string }>(
  async () => { throw new Error('Impresora no responde') }
)

vi.mock('@/shared/lib/odooRepository', () => ({ createSaleOrder: vi.fn() }))
vi.mock('@/shared/lib/fiscalPrinter', () => ({
  FiscalPrinterAdapter: vi.fn().mockImplementation(() => ({
    printFactura: vi.fn().mockResolvedValue({ numfactura: '001', fecha: '2026-06-30', hora: '10:00', serial: 'A1' })
  }))
}))

const customer: KioskPartner = { id: 1, name: 'Juan Perez', cedula: 'V-12345678' }
const cart: CartItem[] = [
  { productId: 1, name: 'Producto A', defaultCode: 'P-A', price: 50, priceUsd: 5, taxRate: 0.16, qty: 1, subtotal: 50 }
]
const method: KioskPaymentMethod = {
  id: 7, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
  journalId: 1, currencyId: 1, useForChange: false
}
const payment: ActivePayment = { methodId: 7, reference: '', amount: 50, igtfAmount: 0 }

function runToEnteringDetails(actor: ReturnType<typeof createActor<typeof saleMachine>>) {
  actor.send({ type: 'START' })
  actor.send({ type: 'FOUND', customer })
  actor.send({ type: 'CHECKOUT', cart })
  actor.send({ type: 'PAY' })
  actor.send({ type: 'SELECT_METHOD', method })
}

describe('saleMachine — happy path transitions', () => {
  it('walks idle -> enteringCedula -> browsingProducts -> reviewingCart -> selectingMethod -> enteringDetails', () => {
    const actor = createActor(saleMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('enteringCedula')

    actor.send({ type: 'FOUND', customer })
    expect(actor.getSnapshot().value).toBe('browsingProducts')
    expect(actor.getSnapshot().context.customer).toEqual(customer)

    actor.send({ type: 'CHECKOUT', cart })
    expect(actor.getSnapshot().value).toBe('reviewingCart')
    expect(actor.getSnapshot().context.cart).toEqual(cart)

    actor.send({ type: 'PAY' })
    expect(actor.getSnapshot().value).toBe('selectingMethod')

    actor.send({ type: 'SELECT_METHOD', method })
    expect(actor.getSnapshot().value).toBe('enteringDetails')
    expect(actor.getSnapshot().context.selectedMethod).toEqual(method)
  })

  it('routes to registeringCustomer when the cedula is not found, then back to browsingProducts on REGISTERED', () => {
    const actor = createActor(saleMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'NOT_FOUND', vat: 'V-99999999' })
    expect(actor.getSnapshot().value).toBe('registeringCustomer')
    expect(actor.getSnapshot().context.pendingVat).toBe('V-99999999')

    actor.send({ type: 'REGISTERED', customer })
    expect(actor.getSnapshot().value).toBe('browsingProducts')
  })

  it('RESET returns to idle and clears the context from any state', () => {
    const actor = createActor(saleMachine)
    actor.start()
    runToEnteringDetails(actor)
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.customer).toBeNull()
    expect(actor.getSnapshot().context.cart).toEqual([])
  })
})

describe('saleMachine — payment processing', () => {
  it('moves to paymentError and records the message when submitPaymentToOdoo rejects', async () => {
    const failingMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejecting }
    })
    const actor = createActor(failingMachine)
    actor.start()
    runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('paymentError')
    })
    expect(actor.getSnapshot().context.errorMessage).toBe('Odoo no disponible')
  })

  it('RETRY from paymentError goes back to enteringDetails and clears the error', async () => {
    const failingMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejecting }
    })
    const actor = createActor(failingMachine)
    actor.start()
    runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('paymentError'))

    actor.send({ type: 'RETRY' })
    expect(actor.getSnapshot().value).toBe('enteringDetails')
    expect(actor.getSnapshot().context.errorMessage).toBeNull()
  })

  it('reaches success once payment and printing both resolve', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('success')
    })
    expect(actor.getSnapshot().context.printerResult).toEqual({ code: '001', date: '2026-06-30 10:00', serial: 'A1' })
  })

  it('still reaches success (degraded) when printing fails after a successful payment', async () => {
    const degradedMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printRejecting }
    })
    const actor = createActor(degradedMachine)
    actor.start()
    runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('success')
    })
    expect(actor.getSnapshot().context.printError).toBe('Impresora no responde')
  })
})
