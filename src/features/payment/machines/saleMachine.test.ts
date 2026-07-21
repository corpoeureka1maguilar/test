import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { saleMachine } from './saleMachine'
import { OdooServerError } from '@/shared/lib/odooEnv'
import { QueueFullError } from '@/shared/lib/orderQueue'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData, GiftCard } from '@/shared/types/types'

type SubmitInput = { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string; giftCard: GiftCard | null }
type EnqueueInput = { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string }
type PrintInput = { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string; giftCard: GiftCard | null }

// Error transitorio (red/timeout/5xx): plain Error, es DEFERRABLE -> enqueuingOffline
const submitPaymentRejecting = fromPromise<unknown, SubmitInput>(
  async () => { throw new Error('Odoo no disponible') }
)
// Rechazo permanente de Odoo (regla de negocio): NO es deferrable -> paymentError
const submitPaymentRejectingPermanent = fromPromise<unknown, SubmitInput>(
  async () => { throw new OdooServerError('Cliente bloqueado', 'odoo.exceptions.UserError') }
)
const submitPaymentResolving = fromPromise<unknown, SubmitInput>(
  async () => ({ ok: true })
)
const enqueueOfflineOrderResolving = fromPromise<unknown, EnqueueInput>(
  async ({ input }) => ({ id: input.attemptId })
)
const enqueueOfflineOrderRejectingFull = fromPromise<unknown, EnqueueInput>(
  async () => { throw new QueueFullError() }
)
const printResolving = fromPromise<PrinterInvoiceData, PrintInput>(
  async () => ({ code: '001', date: '2026-06-30 10:00', serial: 'A1' })
)
const printRejecting = fromPromise<PrinterInvoiceData, PrintInput>(
  async () => { throw new Error('Impresora no responde') }
)

vi.mock('@/shared/lib/odooRepository', () => ({
  createSaleOrder: vi.fn(),
  setOrderPrinterData: vi.fn().mockResolvedValue(undefined),
  // checkingLoyalty invoca esto al salir de browsingProducts (ver saleMachine.ts);
  // sin motores requeridos avanza directo a selectingMethod
  validateLoyalty: vi.fn().mockResolvedValue([])
}))
vi.mock('@/shared/lib/fiscalPrinter', () => ({
  FiscalPrinterAdapter: vi.fn().mockImplementation(() => ({
    printFactura: vi.fn().mockResolvedValue({ numfactura: '001', fecha: '2026-06-30', hora: '10:00', serial: 'A1' })
  }))
}))
vi.mock('@/shared/lib/orderQueue', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/orderQueue')>('@/shared/lib/orderQueue')
  return { ...actual, enqueue: vi.fn(), patchFiscal: vi.fn().mockResolvedValue(undefined) }
})

import { enqueue as enqueueOrderMock, patchFiscal as patchFiscalMock } from '@/shared/lib/orderQueue'

const customer: KioskPartner = { id: 1, name: 'Juan Perez', cedula: 'V-12345678' }
const cart: CartItem[] = [
  { productId: 1, name: 'Producto A', defaultCode: 'P-A', price: 50, priceUsd: 5, taxRate: 0.16, qty: 1, subtotal: 50 }
]
const method: KioskPaymentMethod = {
  id: 7, name: 'Efectivo', paymentType: 'cash', applyIgtf: false, igtfPercent: 0,
  journalId: 1, currencyId: 1, useForChange: false
}
const payment: ActivePayment = { methodId: 7, reference: '', amount: 50, igtfAmount: 0 }

async function runToEnteringDetails(actor: ReturnType<typeof createActor<typeof saleMachine>>) {
  actor.send({ type: 'START' })
  actor.send({ type: 'FOUND', customer })
  actor.send({ type: 'CHECKOUT', cart })
  // checkingLoyalty invoca validateLoyalty de forma asincrónica antes de
  // llegar a selectingMethod (ver saleMachine.ts) — hay que esperarlo
  await waitFor(actor, (snapshot) => snapshot.matches('selectingMethod'))
  actor.send({ type: 'SELECT_METHOD', method })
}

describe('saleMachine — happy path transitions', () => {
  it('walks idle -> enteringCedula -> browsingProducts -> checkingLoyalty -> selectingMethod -> enteringDetails', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('enteringCedula')

    actor.send({ type: 'FOUND', customer })
    expect(actor.getSnapshot().value).toBe('browsingProducts')
    expect(actor.getSnapshot().context.customer).toEqual(customer)

    actor.send({ type: 'CHECKOUT', cart })
    expect(actor.getSnapshot().value).toBe('checkingLoyalty')
    expect(actor.getSnapshot().context.cart).toEqual(cart)

    await waitFor(actor, (snapshot) => snapshot.matches('selectingMethod'))

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

  it('RESET returns to idle and clears the context from any state', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.customer).toBeNull()
    expect(actor.getSnapshot().context.cart).toEqual([])
  })
})

describe('saleMachine — payment processing', () => {
  it('moves to paymentError and records the message when Odoo permanently rejects the sale (OdooServerError)', async () => {
    const failingMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejectingPermanent }
    })
    const actor = createActor(failingMachine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('paymentError')
    })
    expect(actor.getSnapshot().context.errorMessage).toBe('Cliente bloqueado')
  })

  it('RETRY from paymentError goes back to enteringDetails and clears the error', async () => {
    const failingMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejectingPermanent }
    })
    const actor = createActor(failingMachine)
    actor.start()
    await runToEnteringDetails(actor)
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
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('success')
    })
    expect(actor.getSnapshot().context.printerResult).toEqual({ code: '001', date: '2026-06-30 10:00', serial: 'A1' })
  })

  it('RESET while processing cancels the in-flight submission and returns to idle', async () => {
    const neverResolving = fromPromise<unknown, SubmitInput>(
      () => new Promise(() => {})
    )
    const stuckMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: neverResolving }
    })
    const actor = createActor(stuckMachine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })
    expect(actor.getSnapshot().value).toBe('processing')

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.cart).toEqual([])
  })

  it('RESET while printing cancels the in-flight print job and returns to idle', async () => {
    const neverResolving = fromPromise<PrinterInvoiceData, PrintInput>(
      () => new Promise(() => {})
    )
    const stuckMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: neverResolving }
    })
    const actor = createActor(stuckMachine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('printing')
    })

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.cart).toEqual([])
  })

  it('moves to printingError (not success) when printing fails after a successful payment', async () => {
    const degradedMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printRejecting }
    })
    const actor = createActor(degradedMachine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('printingError')
    })
    expect(actor.getSnapshot().context.printError).toBe('Impresora no responde')
  })

  it('RETRY from printingError re-runs the print job and reaches success when it recovers', async () => {
    let attempts = 0
    const flakyPrint = fromPromise<PrinterInvoiceData, PrintInput>(
      async () => {
        attempts++
        if (attempts === 1) throw new Error('Impresora no responde')
        return { code: '002', date: '2026-06-30 10:05', serial: 'A1' }
      }
    )
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: flakyPrint }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('printingError'))

    actor.send({ type: 'RETRY' })
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))
    expect(actor.getSnapshot().context.printError).toBeNull()
    expect(actor.getSnapshot().context.printerResult?.code).toBe('002')
  })

  it('CONTINUE from printingError reaches success keeping the print error visible', async () => {
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printRejecting }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('printingError'))

    actor.send({ type: 'CONTINUE' })
    expect(actor.getSnapshot().value).toBe('success')
    expect(actor.getSnapshot().context.printError).toBe('Impresora no responde')
  })
})

describe('saleMachine — offline enqueue (transient error while Odoo is unreachable)', () => {
  beforeEach(() => {
    vi.mocked(enqueueOrderMock).mockReset()
    vi.mocked(patchFiscalMock).mockReset().mockResolvedValue(undefined)
  })

  it('routes a transient error (plain Error) to enqueuingOffline instead of paymentError', async () => {
    // Congela el enqueue in-flight para poder observar el estado intermedio
    // antes de que avance a printing (enqueueOfflineOrderResolving es demasiado
    // rápido y el waitFor puede llegar tarde)
    const neverResolvingEnqueue = fromPromise<unknown, EnqueueInput>(() => new Promise(() => {}))
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejecting, enqueueOfflineOrder: neverResolvingEnqueue }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('enqueuingOffline'))
  })

  it('proceeds to printing with queuedOffline:true and odooOrderId:null once the offline enqueue succeeds', async () => {
    const machine = saleMachine.provide({
      actors: {
        submitPaymentToOdoo: submitPaymentRejecting,
        enqueueOfflineOrder: enqueueOfflineOrderResolving,
        printFiscalInvoice: printResolving
      }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))
    expect(actor.getSnapshot().context.queuedOffline).toBe(true)
    expect(actor.getSnapshot().context.odooOrderId).toBeNull()
    expect(actor.getSnapshot().context.printerResult).toEqual({ code: '001', date: '2026-06-30 10:00', serial: 'A1' })
  })

  it('routes to paymentError when the offline queue is full (enqueue rejects)', async () => {
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejecting, enqueueOfflineOrder: enqueueOfflineOrderRejectingFull }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('paymentError'))
    expect(actor.getSnapshot().context.errorMessage).toMatch(/cola offline/i)
  })

  it('printing.onDone patches the queue entry fiscal data when the sale was queued offline', async () => {
    const machine = saleMachine.provide({
      actors: {
        submitPaymentToOdoo: submitPaymentRejecting,
        enqueueOfflineOrder: enqueueOfflineOrderResolving,
        printFiscalInvoice: printResolving
      }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetails(actor)
    const attemptId = actor.getSnapshot().context.saleAttemptId
    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))
    expect(patchFiscalMock).toHaveBeenCalledWith(attemptId, { code: '001', date: '2026-06-30 10:00', serial: 'A1' })
  })
})

describe('saleMachine — sale attempt dedup id', () => {
  it('assigns saleAttemptId when entering enteringDetails and keeps it across RETRY', async () => {
    const failingMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejectingPermanent }
    })
    const actor = createActor(failingMachine)
    actor.start()
    await runToEnteringDetails(actor)

    const firstId = actor.getSnapshot().context.saleAttemptId
    expect(firstId).toBeTruthy()

    actor.send({ type: 'SUBMIT_PAYMENT', payment })
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('paymentError'))

    // El reintento del MISMO intento de venta debe conservar el x_fex_id para
    // que Odoo deduplique si la orden ya se creó pese al error/timeout
    actor.send({ type: 'RETRY' })
    expect(actor.getSnapshot().context.saleAttemptId).toBe(firstId)
  })

  it('generates a fresh saleAttemptId after RESET (new sale)', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetails(actor)
    const firstId = actor.getSnapshot().context.saleAttemptId

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().context.saleAttemptId).toBeNull()

    await runToEnteringDetails(actor)
    const secondId = actor.getSnapshot().context.saleAttemptId
    expect(secondId).toBeTruthy()
    expect(secondId).not.toBe(firstId)
  })
})
