import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { saleMachine } from './saleMachine'
import { OdooServerError } from '@/shared/lib/odooEnv'
import { QueueFullError } from '@/shared/lib/orderQueue'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData, GiftCard, PaymentLeg } from '@/shared/types/types'

type SubmitInput = { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string; giftCard: GiftCard | null; legs: PaymentLeg[] }
type EnqueueInput = { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string; giftCard: GiftCard | null; legs: PaymentLeg[] }
type PrintInput = { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string; giftCard: GiftCard | null; legs: PaymentLeg[] }

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
const { mockPrintFactura } = vi.hoisted(() => ({
  mockPrintFactura: vi.fn().mockResolvedValue({ numfactura: '001', fecha: '2026-06-30', hora: '10:00', serial: 'A1' })
}))
vi.mock('@/shared/lib/fiscalPrinter', () => ({
  FiscalPrinterAdapter: vi.fn().mockImplementation(function FiscalPrinterAdapterMock(this: { printFactura: typeof mockPrintFactura }) {
    this.printFactura = mockPrintFactura
  })
}))
vi.mock('@/shared/stores/exchangeRate', () => ({
  useExchangeRateStore: { getState: vi.fn(() => ({ rate: 40 })) }
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
  journalId: 1, currencyId: 1, useForChange: false,
  // generic-partial-payment (Fase 2): buildFacturaPayload ahora explota si un
  // tender llega sin printerCode real — este fixture alimenta el único test
  // de este archivo que ejercita el printFiscalInvoice REAL (no mockeado):
  // "printing wiring: the REAL printFiscalInvoice ...".
  printerCode: '01'
}
const payment: ActivePayment = { methodId: 7, reference: '', amount: 50, igtfAmount: 0 }

async function runToEnteringDetailsWithMethod(
  actor: ReturnType<typeof createActor<typeof saleMachine>>,
  selectedMethod: KioskPaymentMethod
) {
  actor.send({ type: 'START' })
  actor.send({ type: 'FOUND', customer })
  actor.send({ type: 'CHECKOUT', cart })
  // checkingLoyalty invoca validateLoyalty de forma asincrónica antes de
  // llegar a selectingMethod (ver saleMachine.ts) — hay que esperarlo
  await waitFor(actor, (snapshot) => snapshot.matches('selectingMethod'))
  actor.send({ type: 'SELECT_METHOD', method: selectedMethod })
}

async function runToEnteringDetails(actor: ReturnType<typeof createActor<typeof saleMachine>>) {
  await runToEnteringDetailsWithMethod(actor, method)
}

beforeEach(() => {
  mockPrintFactura.mockClear()
})

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

describe('saleMachine — gift card partial payment (2-leg remainder, GIFT_CARD_PARTIAL)', () => {
  const giftCardMethod: KioskPaymentMethod = {
    id: -999, name: 'Tarjeta de regalo', paymentType: 'otro', applyIgtf: false, igtfPercent: 0,
    journalId: 5, currencyId: 1, useForChange: false
  }
  const giftCardLeg: GiftCard = { id: 10, code: 'GC-001', amount: 30, balance: 30, state: 'available' }
  const remainingAmount = 20

  it('enteringDetails --GIFT_CARD_PARTIAL--> selectingMethod, persisting giftCardLeg and remainingAmount in context', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    expect(actor.getSnapshot().value).toBe('enteringDetails')

    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount })

    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.giftCardLeg).toEqual(giftCardLeg)
    expect(actor.getSnapshot().context.remainingAmount).toBe(remainingAmount)
  })

  it('a second SUBMIT_PAYMENT after selecting the remainder method moves to processing carrying both legs in context', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount })
    actor.send({ type: 'SELECT_METHOD', method })
    expect(actor.getSnapshot().value).toBe('enteringDetails')

    actor.send({ type: 'SUBMIT_PAYMENT', payment: { ...payment, amount: remainingAmount } })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.giftCardLeg).toEqual(giftCardLeg)
    expect(actor.getSnapshot().context.selectedMethod).toEqual(method)
    expect(actor.getSnapshot().context.activePayment?.amount).toBe(remainingAmount)
  })

  it('keeps saleAttemptId stable across the full 2-leg loop (first enteringDetails through the second SUBMIT_PAYMENT)', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    const firstId = actor.getSnapshot().context.saleAttemptId
    expect(firstId).toBeTruthy()

    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount })
    actor.send({ type: 'SELECT_METHOD', method })
    expect(actor.getSnapshot().context.saleAttemptId).toBe(firstId)

    actor.send({ type: 'SUBMIT_PAYMENT', payment: { ...payment, amount: remainingAmount } })
    expect(actor.getSnapshot().context.saleAttemptId).toBe(firstId)
  })

  it('enqueuingOffline actor input carries giftCardLeg ?? giftCard (bug fix, engram #423 — previously missing entirely)', async () => {
    let capturedInput: EnqueueInput | null = null
    const enqueueOfflineOrderCapturing = fromPromise<unknown, EnqueueInput>(async ({ input }) => {
      capturedInput = input
      return { id: input.attemptId }
    })
    const machine = saleMachine.provide({
      actors: {
        submitPaymentToOdoo: submitPaymentRejecting,
        enqueueOfflineOrder: enqueueOfflineOrderCapturing,
        printFiscalInvoice: printResolving
      }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount })
    actor.send({ type: 'SELECT_METHOD', method })
    actor.send({ type: 'SUBMIT_PAYMENT', payment: { ...payment, amount: remainingAmount } })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))
    expect(capturedInput).not.toBeNull()
    expect(capturedInput!.giftCard).toEqual(giftCardLeg)
  })

  it('T4.1 offline replay integration: the REAL enqueueOfflineOrder (not overridden) persists a 2-leg partial payload identical in shape to an online submission (engram #423, full cycle)', async () => {
    // A diferencia del test anterior (que sobreescribe enqueueOfflineOrder por
    // un stub que solo captura el INPUT crudo), acá NO se sobreescribe el actor:
    // se ejerce la implementación real de enqueueOfflineOrder, que a su vez
    // llama a buildSaleOrderPayload (la misma función que usa el camino online,
    // submitPaymentToOdoo) — así se cierra la brecha de cobertura end-to-end
    // del bug #423: el payload que efectivamente se persiste en la cola offline
    // (y que syncManager.drain() reenvía LUEGO verbatim, sin reconstruir — ver
    // syncManager.ts) debe tener la misma forma de 2-leg parcial que tendría un
    // envío online equivalente.
    vi.mocked(enqueueOrderMock).mockReset()
    const smallGiftCardLeg: GiftCard = { id: 10, code: 'GC-001', amount: 0.5, balance: 0.5, state: 'available' }
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentRejecting, printFiscalInvoice: printResolving }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: smallGiftCardLeg, remainingAmount })
    actor.send({ type: 'SELECT_METHOD', method })
    const attemptId = actor.getSnapshot().context.saleAttemptId
    actor.send({ type: 'SUBMIT_PAYMENT', payment: { ...payment, amount: remainingAmount } })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))
    expect(actor.getSnapshot().context.queuedOffline).toBe(true)
    expect(enqueueOrderMock).toHaveBeenCalledTimes(1)

    const [enqueuedId, enqueuedPayload] = vi.mocked(enqueueOrderMock).mock.calls[0]! as [string, ReturnType<typeof import('@/shared/lib/saleOrderPayload').buildSaleOrderPayload>]
    expect(enqueuedId).toBe(attemptId)

    // cart (const del archivo): 1 item, price 50, taxRate 0.16 -> totalBs = 58.
    // rate mockeado (@/shared/stores/exchangeRate) = 40. giftCard leg consumido:
    // 0.5 USD -> consumedBs = 20 -> remainderBs = 58 - 20 = 38 (mismos números
    // y misma fórmula que T1.3/T1.4 ejercitan directamente sobre
    // buildSaleOrderPayload — acá se prueba que el camino offline llega al
    // mismo resultado, no solo la función en aislamiento).
    expect(enqueuedPayload.payments).toHaveLength(1)
    expect(enqueuedPayload.payments[0]!.amount).toBe(38)
    expect(enqueuedPayload.payments[0]!.montoIgtf).toBe(0)
    expect(enqueuedPayload.payments[0]!.method).toBe(method.id)
    expect(enqueuedPayload.giftCard).toEqual({ id: 10, code: 'GC-001', amount: 0.5, balance: 0.5, state: 'available' })
  })

  it('regression: full-balance path (method.id === -999 via a single SUBMIT_PAYMENT) is unaffected — no GIFT_CARD_PARTIAL, giftCardLeg/remainingAmount stay null', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    const fullGiftCard: GiftCard = { id: 10, code: 'GC-001', amount: 50, balance: 50, state: 'available' }

    actor.send({
      type: 'SUBMIT_PAYMENT',
      payment: { methodId: -999, reference: 'GC-001', amount: 50, igtfAmount: 0 },
      giftCard: fullGiftCard
    })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.giftCard).toEqual(fullGiftCard)
    expect(actor.getSnapshot().context.giftCardLeg).toBeNull()
    expect(actor.getSnapshot().context.remainingAmount).toBeNull()
  })

  it('regression: normal single-method path is unaffected by the new context fields', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetails(actor)
    expect(actor.getSnapshot().context.giftCardLeg).toBeNull()
    expect(actor.getSnapshot().context.remainingAmount).toBeNull()
  })

  it('printing wiring: the REAL printFiscalInvoice (not overridden) splits the fiscal invoice into two tenders (pago15 + pago01) for the 2-leg remainder', async () => {
    // No se sobreescribe printFiscalInvoice: se ejerce la implementación real
    // (construcción de tenders[] desde legs[] + giftCard, Fase 2) contra el
    // FiscalPrinterAdapter mockeado.
    // cart (const del archivo): 1 producto, qty 1, price 50 -> totalBs impreso
    // (sin impuesto, fórmula actual de printFiscalInvoice) = 50.
    // globalRate mockeado (@/shared/stores/exchangeRate) = 40.
    // giftCard leg consumido: 0.5 USD -> consumedBs = 0.5*40 = 20,
    // remainderBs = 50 - 20 = 30 (ambos positivos, escenario realista).
    const smallGiftCardLeg: GiftCard = { id: 10, code: 'GC-001', amount: 0.5, balance: 0.5, state: 'available' }
    const machine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving }
    })
    const actor = createActor(machine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: smallGiftCardLeg, remainingAmount })
    actor.send({ type: 'SELECT_METHOD', method })
    actor.send({ type: 'SUBMIT_PAYMENT', payment: { ...payment, amount: remainingAmount } })

    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe('success'))

    expect(mockPrintFactura).toHaveBeenCalledTimes(1)
    const [payload] = mockPrintFactura.mock.calls[0] as [Record<string, unknown>]
    expect(payload).toHaveProperty('pago15')
    expect(payload).toHaveProperty('pago01')
    const pago15 = Number(payload['pago15']) / 100
    const pago01 = Number(payload['pago01']) / 100
    expect(pago15).toBe(20)
    expect(pago01).toBe(30)
    expect(pago15 + pago01).toBe(50) // totalAmountBs impreso original (sin dividir)
  })
})

describe('saleMachine — generic N-leg VPOS payment (VPOS_LEG_PAID / legs[] / coversRemaining / commitLeg)', () => {
  const vposMethodA: KioskPaymentMethod = {
    id: 3, name: 'Terminal Banesco', paymentType: 'card', applyIgtf: false, igtfPercent: 0,
    journalId: 9, currencyId: 1, useForChange: false, withMerchant: true
  }
  const vposMethodB: KioskPaymentMethod = {
    id: 4, name: 'Terminal Provincial', paymentType: 'card', applyIgtf: false, igtfPercent: 0,
    journalId: 10, currencyId: 1, useForChange: false, withMerchant: true
  }
  const giftCardMethod: KioskPaymentMethod = {
    id: -999, name: 'Tarjeta de regalo', paymentType: 'otro', applyIgtf: false, igtfPercent: 0,
    journalId: 5, currencyId: 1, useForChange: false
  }
  const giftCardLeg: GiftCard = { id: 10, code: 'GC-001', amount: 30, balance: 30, state: 'available' }

  it('1. VPOS_LEG_PAID with baseBs < remainingAmount loops back to selectingMethod, pushing a leg and decrementing remainingAmount', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 50 })
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })
    expect(actor.getSnapshot().value).toBe('enteringDetails')

    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 30, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 30
    })

    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.legs).toHaveLength(1)
    expect(actor.getSnapshot().context.legs[0]!.method).toEqual(vposMethodA)
    expect(actor.getSnapshot().context.legs[0]!.baseBs).toBe(30)
    expect(actor.getSnapshot().context.remainingAmount).toBe(20)
  })

  it('2. VPOS_LEG_PAID with baseBs === remainingAmount (coversRemaining) moves to processing, including the closing leg', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 20 })
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })

    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 20, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 20
    })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.legs).toHaveLength(1)
    expect(actor.getSnapshot().context.legs[0]!.baseBs).toBe(20)
    expect(actor.getSnapshot().context.remainingAmount).toBe(0)
  })

  it('3. regression: GIFT_CARD_PARTIAL is unaffected by legs[] — still an unconditional loop, never touches legs', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)

    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 50 })

    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.giftCardLeg).toEqual(giftCardLeg)
    expect(actor.getSnapshot().context.remainingAmount).toBe(50)
    expect(actor.getSnapshot().context.legs).toEqual([])
  })

  it('4. saleAttemptId stays stable across 2+ VPOS_LEG_PAID loop iterations', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    const firstId = actor.getSnapshot().context.saleAttemptId
    expect(firstId).toBeTruthy()

    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 50 })
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 30, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 30
    })
    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.saleAttemptId).toBe(firstId)

    actor.send({ type: 'SELECT_METHOD', method: vposMethodB })
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodB.id, reference: 'REF-B', amount: 20, igtfAmount: 0 },
      method: vposMethodB,
      baseBs: 20
    })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.saleAttemptId).toBe(firstId)
    expect(actor.getSnapshot().context.legs).toHaveLength(2)
    expect(actor.getSnapshot().context.legs.map((l) => l.method.id)).toEqual([vposMethodA.id, vposMethodB.id])
  })

  it('5. resetContext includes legs: []', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 50 })
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 30, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 30
    })
    expect(actor.getSnapshot().context.legs).toHaveLength(1)

    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.legs).toEqual([])
  })

  it('6. regression: SUBMIT_PAYMENT (legacy non-VPOS/full-gift-card path) still goes straight to processing unchanged, never touches legs', async () => {
    const actor = createActor(saleMachine)
    actor.start()
    await runToEnteringDetails(actor)

    actor.send({ type: 'SUBMIT_PAYMENT', payment })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.legs).toEqual([])
  })

  it('7. regression (design decision, null-remainingAmount fallback): a single VPOS-only leg with no gift card and no prior leg closes immediately (byte-identical to pre-change single-method behavior)', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, vposMethodA)
    expect(actor.getSnapshot().context.remainingAmount).toBeNull()

    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 50, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 50
    })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.legs).toHaveLength(1)
    expect(actor.getSnapshot().context.remainingAmount).toBe(0)
  })

  // ─── Phase 4 / T4.1 — Retry/resiliencia: rechazo/timeout VPOS a mitad de una
  // venta multi-pierna (generic-partial-payment / "VPOS Leg Failure Recovery
  // Preserves State"). Analogous a T4.1 del change anterior (offline replay
  // integration): en vez de mockear un evento de "rechazo" (la máquina NO
  // tiene ningún evento para eso — ver useVposCheckout.ts: codRespuesta !== '00'
  // solo dispara un toast, NUNCA un send() a la máquina), el test reproduce el
  // contrato real: un intento fallido/timeout del terminal simplemente NO
  // despacha VPOS_LEG_PAID (ni ningún otro evento) — así que la forma correcta
  // de probar "resiliencia" es no enviar nada, snapshotear legs/remainingAmount
  // antes y después del "intento", y confirmar que el cajero puede seguir
  // operando (reintentar el mismo método u otro) sin perder las piernas ya
  // cobradas ni reconstruir el remanente.
  it('T4.1 retry/resiliencia: a 3rd VPOS attempt that fails (codRespuesta !== \'00\', no VPOS_LEG_PAID dispatched) leaves legs/remainingAmount byte-identical, keeps the machine out of processing/paymentError, and the cashier can retry the same or a different method without losing the 2 prior legs', async () => {
    const successMachine = saleMachine.provide({
      actors: { submitPaymentToOdoo: submitPaymentResolving, printFiscalInvoice: printResolving }
    })
    const actor = createActor(successMachine)
    actor.start()
    await runToEnteringDetailsWithMethod(actor, giftCardMethod)

    // Pierna 0 (gift card, no cuenta como VPOS leg): deja remainingAmount=70.
    actor.send({ type: 'GIFT_CARD_PARTIAL', giftCard: giftCardLeg, remainingAmount: 70 })

    // Pierna 1 (VPOS A, $30) — loop-back, remainingAmount=40.
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodA.id, reference: 'REF-A', amount: 30, igtfAmount: 0 },
      method: vposMethodA,
      baseBs: 30
    })
    expect(actor.getSnapshot().value).toBe('selectingMethod')

    // Pierna 2 (VPOS B, $15) — loop-back, remainingAmount=25 (todavía > 0, a
    // propósito, para que el 3er intento sea un intento MEDIO de la venta,
    // no el que la cierra).
    actor.send({ type: 'SELECT_METHOD', method: vposMethodB })
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodB.id, reference: 'REF-B', amount: 15, igtfAmount: 0 },
      method: vposMethodB,
      baseBs: 15
    })
    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.legs).toHaveLength(2)
    expect(actor.getSnapshot().context.remainingAmount).toBe(25)

    // Snapshot byte-a-byte de las 2 piernas ya cobradas + el remanente, ANTES
    // del 3er intento fallido.
    const legsBefore = actor.getSnapshot().context.legs
    const remainingBefore = actor.getSnapshot().context.remainingAmount

    // Cajero elige un 3er método VPOS (Terminal Banesco de nuevo — mismo
    // método reseleccionado, spec "Same VPOS Method Selectable") para la
    // pierna 3.
    actor.send({ type: 'SELECT_METHOD', method: vposMethodA })
    expect(actor.getSnapshot().value).toBe('enteringDetails')

    // El terminal responde codRespuesta !== '00' (rechazo/timeout). Por
    // contrato real de useVposCheckout.ts, esto NUNCA despacha VPOS_LEG_PAID
    // (ni ningún otro evento a la máquina) — solo un toast de error en la UI.
    // No se envía ningún evento acá: eso ES el escenario de fallo.

    // La máquina NUNCA entró a processing/paymentError por este intento.
    expect(actor.getSnapshot().value).toBe('enteringDetails')
    expect(actor.getSnapshot().value).not.toBe('processing')
    expect(actor.getSnapshot().value).not.toBe('paymentError')

    // legs/remainingAmount quedan BYTE-IDÉNTICOS al estado pre-intento.
    expect(actor.getSnapshot().context.legs).toEqual(legsBefore)
    expect(actor.getSnapshot().context.legs).toHaveLength(2)
    expect(actor.getSnapshot().context.remainingAmount).toBe(remainingBefore)
    expect(actor.getSnapshot().context.remainingAmount).toBe(25)

    // El cajero puede reintentar SIN perder las piernas previas: vuelve a
    // selectingMethod (BACK) y elige un método DISTINTO para la pierna 3.
    actor.send({ type: 'BACK' })
    expect(actor.getSnapshot().value).toBe('selectingMethod')
    expect(actor.getSnapshot().context.legs).toEqual(legsBefore)
    expect(actor.getSnapshot().context.remainingAmount).toBe(25)

    actor.send({ type: 'SELECT_METHOD', method: vposMethodB })
    expect(actor.getSnapshot().value).toBe('enteringDetails')

    // Esta vez el terminal SÍ confirma (codRespuesta === '00') y cubre el
    // remanente exacto — la venta cierra con las 3 piernas VPOS/gift-card
    // completas, ninguna perdida por el intento fallido anterior.
    actor.send({
      type: 'VPOS_LEG_PAID',
      payment: { methodId: vposMethodB.id, reference: 'REF-B2', amount: 25, igtfAmount: 0 },
      method: vposMethodB,
      baseBs: 25
    })

    expect(actor.getSnapshot().value).toBe('processing')
    expect(actor.getSnapshot().context.legs).toHaveLength(3)
    expect(actor.getSnapshot().context.remainingAmount).toBe(0)
  })
})
