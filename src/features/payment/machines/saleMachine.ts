import { setup, assign, fromPromise, fromCallback } from 'xstate'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData } from '@/shared/types/types'
import { createSaleOrder, setOrderPrinterData } from '@/shared/lib/odooRepository'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import { buildFacturaPayload } from '@/shared/lib/printPayload'
import { buildSaleOrderPayload } from '@/shared/lib/saleOrderPayload'
import { useConfigStore } from '@/shared/stores/config'
import { randomUUID } from '@/shared/lib/cryptoUtils'
import { OdooServerError } from '@/shared/lib/odooEnv'
import { enqueue as enqueueOrder, patchFiscal } from '@/shared/lib/orderQueue'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SaleContext {
  customer: KioskPartner | null
  pendingVat: string | null         // cédula ingresada cuando no se encontró partner
  cart: CartItem[]
  selectedMethod: KioskPaymentMethod | null
  activePayment: ActivePayment | null
  saleAttemptId: string | null      // x_fex_id: estable durante todo el intento de venta (dedup en Odoo)
  odooOrderId: number | null        // id de la orden creada en Odoo, para registrar el n° fiscal
  queuedOffline: boolean            // true si la venta se encoló localmente (Odoo inalcanzable)
  printerResult: PrinterInvoiceData | null
  errorMessage: string | null
  printError: string | null
  countdown: number
}

// ─── Events ──────────────────────────────────────────────────────  ─────────────

export type SaleEvent =
  | { type: 'START' }
  | { type: 'FOUND'; customer: KioskPartner }
  | { type: 'NOT_FOUND'; vat: string }
  | { type: 'REGISTERED'; customer: KioskPartner }
  | { type: 'CHECKOUT'; cart: CartItem[] }
  | { type: 'PAY' }
  | { type: 'SELECT_METHOD'; method: KioskPaymentMethod }
  | { type: 'SUBMIT_PAYMENT'; payment: ActivePayment }
  | { type: 'TICK' }
  | { type: 'RETRY' }
  | { type: 'CONTINUE' }
  | { type: 'BACK' }
  | { type: 'RESET' }

// ─── Services ─────────────────────────────────────────────────────────────────

const countdownTick = fromCallback(({ sendBack }) => {
  const id = setInterval(() => sendBack({ type: 'TICK' }), 1000)
  return () => clearInterval(id)
})

const submitPaymentToOdoo = fromPromise<
  unknown,
  { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string }
>(async ({ input }) => {
  const { customer, cart, payment, method, attemptId } = input
  const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
  return createSaleOrder(payload)
})

// Solo se invoca cuando submitPaymentToOdoo falló con un error DEFERRABLE
// (ver isDeferrableError). Construye el payload UNA vez y lo persiste
// verbatim: el synchronizer lo reenvía tal cual, nunca lo reconstruye
// (ver ADR-1/ADR-2 del design — evita drift de tasa/líneas que rompería
// la deduplicación por x_fex_id en el backend).
const enqueueOfflineOrder = fromPromise<
  unknown,
  { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string }
>(async ({ input }) => {
  const { customer, cart, payment, method, attemptId } = input
  const payload = buildSaleOrderPayload(customer, cart, payment, method, attemptId)
  return enqueueOrder(attemptId, payload)
})

// Odoo devuelve OdooServerError para rechazos de negocio permanentes
// (crédito bloqueado, validación, etc.) — esos jamás deben encolarse offline.
// Cualquier otro Error (red, timeout, 5xx) se asume transitorio y se difiere.
function isDeferrableError(error: unknown): boolean {
  return !(error instanceof OdooServerError)
}

const printFiscalInvoice = fromPromise<
  PrinterInvoiceData,
  { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string }
>(async ({ input, signal }) => {
  const { customer, cart, method, printerUrl, printerModel } = input
  const printer = new FiscalPrinterAdapter(printerUrl, printerModel)

  const totalBs = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const igtfBs = method.applyIgtf ? totalBs * (method.igtfPercent / 100) : 0
  const totalAmountBs = totalBs + igtfBs

  const payload = buildFacturaPayload(
    customer.name,
    customer.cedula,
    cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, taxRate: i.taxRate })),
    method,
    totalAmountBs
  )
  const response = await printer.printFactura(payload as Record<string, unknown>, signal)
  return {
    code: String(response.numfactura || response.numNota || ''),
    date: `${response.fecha} ${response.hora}`.trim(),
    serial: response.serial
  }
})

// ─── Machine ──────────────────────────────────────────────────────────────────

export const saleMachine = setup({
  types: { context: {} as SaleContext, events: {} as SaleEvent },
  actors: { submitPaymentToOdoo, printFiscalInvoice, countdownTick, enqueueOfflineOrder },
  guards: {
    isDeferrable: ({ event }) => isDeferrableError((event as { error?: unknown }).error)
  },
  actions: {
    setCustomer: assign({
      customer: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'FOUND' | 'REGISTERED' }>).customer
    }),
    setPendingVat: assign({
      pendingVat: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'NOT_FOUND' }>).vat
    }),
    setCart: assign({
      cart: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'CHECKOUT' }>).cart
    }),
    setMethod: assign({
      selectedMethod: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'SELECT_METHOD' }>).method
    }),
    setPayment: assign({
      activePayment: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'SUBMIT_PAYMENT' }>).payment
    }),
    // Genera el x_fex_id UNA sola vez por intento de venta y lo conserva en
    // los reintentos: si Odoo creó la orden pero el timeout se comió la
    // respuesta, el retry repite el mismo id y el backend deduplica en vez de
    // duplicar la venta. Solo se limpia en resetContext (venta nueva).
    ensureSaleAttemptId: assign({
      saleAttemptId: ({ context }) => context.saleAttemptId ?? randomUUID()
    }),
    setOdooOrderId: assign({
      odooOrderId: ({ event }) => {
        const output = (event as { type: string; output?: { id?: number } }).output
        return typeof output?.id === 'number' ? output.id : null
      }
    }),
    // La venta se encoló localmente: no hay odooOrderId todavía (lo resuelve
    // el synchronizer al drenar) — printing.onDone igual imprime la factura
    setQueuedOffline: assign({
      queuedOffline: true,
      odooOrderId: null
    }),
    // Fire-and-forget: la factura ya imprimió; si el patch falla solo se
    // pierde el dato fiscal para el reintento post-sync (no bloquea la venta)
    patchQueueFiscal: ({ context, event }) => {
      const result = (event as { type: string; output?: PrinterInvoiceData }).output
      if (!context.queuedOffline || !context.saleAttemptId || !result?.code) return
      patchFiscal(context.saleAttemptId, { code: result.code, date: result.date, serial: result.serial })
        .catch((err) => console.error('[saleMachine] Error parcheando fiscal en la cola offline:', err))
    },
    setPrinterResult: assign({
      printerResult: ({ event }) =>
        (event as { type: string; output: PrinterInvoiceData }).output ?? null
    }),
    // Fire-and-forget: la venta ya está impresa; si el registro falla solo se
    // pierde la posibilidad de reimprimir esa orden desde la memoria fiscal
    persistPrinterData: ({ context, event }) => {
      const result = (event as { type: string; output?: PrinterInvoiceData }).output
      if (!context.odooOrderId || !result?.code) return
      setOrderPrinterData(context.odooOrderId, result.code, result.date, result.serial)
        .catch((err) => console.error('[saleMachine] Error registrando n° fiscal en la orden:', err))
    },
    setPaymentError: assign({
      errorMessage: ({ event }) => {
        const e = event as { type: string; error?: unknown }
        return e.error instanceof Error ? e.error.message : String(e.error ?? 'Error desconocido')
      }
    }),
    setPrintError: assign({
      printError: ({ event }) => {
        const e = event as { type: string; error?: unknown }
        return e.error instanceof Error ? e.error.message : String(e.error ?? 'Error de impresión')
      }
    }),
    clearError: assign({ errorMessage: null }),
    clearPrintError: assign({ printError: null }),
    startCountdown: assign({ countdown: 10 }),
    decrementCountdown: assign({ countdown: ({ context }) => context.countdown - 1 }),
    resetContext: assign({
      customer: null,
      pendingVat: null,
      cart: [],
      selectedMethod: null,
      activePayment: null,
      saleAttemptId: null,
      odooOrderId: null,
      queuedOffline: false,
      printerResult: null,
      errorMessage: null,
      printError: null,
      countdown: 0
    })
  }
}).createMachine({
  id: 'sale',
  initial: 'idle',
  context: {
    customer: null,
    pendingVat: null,
    cart: [],
    selectedMethod: null,
    activePayment: null,
    saleAttemptId: null,
    odooOrderId: null,
    queuedOffline: false,
    printerResult: null,
    errorMessage: null,
    printError: null,
    countdown: 0
  },
  states: {
    idle: {
      on: { START: 'enteringCedula' }
    },
 
    enteringCedula: {
      on: {
        FOUND: { target: 'browsingProducts', actions: 'setCustomer' },
        NOT_FOUND: { target: 'registeringCustomer', actions: 'setPendingVat' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },
 
    registeringCustomer: {
      on: {
        REGISTERED: { target: 'browsingProducts', actions: 'setCustomer' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },
 
    browsingProducts: {
      on: {
        CHECKOUT: { target: 'selectingMethod', actions: 'setCart' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    reviewingCart: {
      on: {
        PAY: 'selectingMethod',
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },
 
    selectingMethod: {
      on: {
        SELECT_METHOD: { target: 'enteringDetails', actions: 'setMethod' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },
 
    enteringDetails: {
      entry: 'ensureSaleAttemptId',
      on: {
        SUBMIT_PAYMENT: { target: 'processing', actions: 'setPayment' },
        SELECT_METHOD: { target: 'enteringDetails', actions: 'setMethod' },
        BACK: 'selectingMethod',
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    processing: {
      invoke: {
        src: 'submitPaymentToOdoo',
        input: ({ context }) => {
          if (!context.customer || !context.activePayment || !context.selectedMethod || !context.saleAttemptId) {
            throw new Error('Estado inválido: falta customer, payment, method o attemptId')
          }
          return {
            customer: context.customer,
            cart: context.cart,
            payment: context.activePayment,
            method: context.selectedMethod,
            attemptId: context.saleAttemptId
          }
        },
        onDone: { target: 'printing', actions: ['clearError', 'setOdooOrderId'] },
        // Deferrable (red/timeout/5xx, no OdooServerError): la venta se
        // encola offline en vez de fallar (spec: offline-order-queue).
        // Rechazo permanente de Odoo (regla de negocio) sigue yendo directo
        // a paymentError — nunca se encola algo que Odoo jamás va a aceptar.
        onError: [
          { guard: 'isDeferrable', target: 'enqueuingOffline' },
          { target: 'paymentError', actions: 'setPaymentError' }
        ]
      },
      on: {
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    // Encola el payload en IndexedDB ANTES de imprimir (el n° fiscal todavía
    // no existe); si el encolado falla (cola llena / QuotaExceeded) la venta
    // NO se puede completar offline y se cae a paymentError.
    enqueuingOffline: {
      invoke: {
        src: 'enqueueOfflineOrder',
        input: ({ context }) => {
          if (!context.customer || !context.activePayment || !context.selectedMethod || !context.saleAttemptId) {
            throw new Error('Estado inválido: falta customer, payment, method o attemptId')
          }
          return {
            customer: context.customer,
            cart: context.cart,
            payment: context.activePayment,
            method: context.selectedMethod,
            attemptId: context.saleAttemptId
          }
        },
        onDone: { target: 'printing', actions: ['clearError', 'setQueuedOffline'] },
        onError: { target: 'paymentError', actions: 'setPaymentError' }
      },
      on: {
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    printing: {
      invoke: {
        src: 'printFiscalInvoice',
        input: ({ context }) => {
          if (!context.customer || !context.activePayment || !context.selectedMethod) {
            throw new Error('Estado inválido: falta customer, payment o method')
          }
          return {
            customer: context.customer,
            cart: context.cart,
            method: context.selectedMethod,
            payment: context.activePayment,
            printerUrl: useConfigStore.getState().printerUrl,
            printerModel: useConfigStore.getState().printerModel
          }
        },
        onDone: { target: 'success', actions: ['setPrinterResult', 'persistPrinterData', 'patchQueueFiscal'] },
        // La venta ya se cobró en Odoo pero la factura fiscal no salió: no se
        // puede dar por exitosa sin ofrecer reintento (obligación fiscal).
        onError: { target: 'printingError', actions: 'setPrintError' }
      },
      on: {
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    printingError: {
      on: {
        RETRY: { target: 'printing', actions: 'clearPrintError' },
        // El operador decide continuar sin factura: printError queda en el
        // context para que la pantalla de éxito muestre la advertencia
        CONTINUE: 'success',
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    success: {
      entry: 'startCountdown',
      invoke: { src: 'countdownTick' },
      after: { 10000: { target: 'idle', actions: 'resetContext' } },
      on: {
        TICK: { actions: 'decrementCountdown' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    paymentError: {
      on: {
        RETRY: { target: 'enteringDetails', actions: 'clearError' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    }
  }
})
