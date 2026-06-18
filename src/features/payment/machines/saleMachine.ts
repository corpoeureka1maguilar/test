import { setup, assign, fromPromise, fromCallback } from 'xstate'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData } from '@/shared/types/types'
import { createSaleOrder } from '@/shared/lib/odooRepository'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import { buildFacturaPayload } from '@/shared/lib/printPayload'
import { buildSaleOrderPayload } from '@/shared/lib/saleOrderPayload'
import { useConfigStore } from '@/shared/stores/config'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SaleContext {
  customer: KioskPartner | null
  pendingVat: string | null         // cédula ingresada cuando no se encontró partner
  cart: CartItem[]
  selectedMethod: KioskPaymentMethod | null
  activePayment: ActivePayment | null
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
  | { type: 'BACK' }
  | { type: 'RESET' }

// ─── Services ─────────────────────────────────────────────────────────────────

const countdownTick = fromCallback(({ sendBack }) => {
  const id = setInterval(() => sendBack({ type: 'TICK' }), 1000)
  return () => clearInterval(id)
})

const submitPaymentToOdoo = fromPromise<
  unknown,
  { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod }
>(async ({ input }) => {
  const { customer, cart, payment, method } = input
  const payload = buildSaleOrderPayload(customer, cart, payment, method)
  return createSaleOrder(payload)
})

const printFiscalInvoice = fromPromise<
  PrinterInvoiceData,
  { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string }
>(async ({ input }) => {
  const { customer, cart, method, printerUrl, printerModel } = input
  const printer = new FiscalPrinterAdapter(printerUrl, printerModel)
  
  const totalBs = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const igtfBs = method.applyIgtf ? totalBs * (method.igtfPercent / 100) : 0
  const totalAmountBs = totalBs + igtfBs

  const payload = buildFacturaPayload(
    customer.name,
    customer.cedula,
    cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    method,
    totalAmountBs
  )
  const response = await printer.printFactura(payload as Record<string, unknown>)
  return {
    code: String(response.numfactura || response.numNota || ''),
    date: `${response.fecha} ${response.hora}`.trim(),
    serial: response.serial
  }
})

// ─── Machine ──────────────────────────────────────────────────────────────────

export const saleMachine = setup({
  types: { context: {} as SaleContext, events: {} as SaleEvent },
  actors: { submitPaymentToOdoo, printFiscalInvoice, countdownTick },
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
    setPrinterResult: assign({
      printerResult: ({ event }) =>
        (event as { type: string; output: PrinterInvoiceData }).output ?? null
    }),
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
    startCountdown: assign({ countdown: 10 }),
    decrementCountdown: assign({ countdown: ({ context }) => context.countdown - 1 }),
    resetContext: assign({
      customer: null,
      pendingVat: null,
      cart: [],
      selectedMethod: null,
      activePayment: null,
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
        CHECKOUT: { target: 'reviewingCart', actions: 'setCart' },
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
          if (!context.customer || !context.activePayment || !context.selectedMethod) {
            throw new Error('Estado inválido: falta customer, payment o method')
          }
          return {
            customer: context.customer,
            cart: context.cart,
            payment: context.activePayment,
            method: context.selectedMethod
          }
        },
        onDone: { target: 'printing', actions: 'clearError' },
        onError: { target: 'paymentError', actions: 'setPaymentError' }
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
        onDone: { target: 'success', actions: 'setPrinterResult' },
        onError: { target: 'success', actions: 'setPrintError' }
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
