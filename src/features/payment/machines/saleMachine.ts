import { setup, assign, fromPromise, fromCallback } from 'xstate'
import type { KioskPartner, CartItem, KioskPaymentMethod, ActivePayment, PrinterInvoiceData, GiftCard, PaymentLeg } from '@/shared/types/types'
import type { RequiredEngine } from '@/shared/lib/odooRepository'
import { createSaleOrder, setOrderPrinterData, assignCardFromSale, validateLoyalty } from '@/shared/lib/odooRepository'
import { FiscalPrinterAdapter, noFiscalItem } from '@/shared/lib/fiscalPrinter'
import { buildFacturaPayload, GIFT_CARD_TENDER_CODE, type Tender } from '@/shared/lib/printPayload'
import { buildSaleOrderPayload } from '@/shared/lib/saleOrderPayload'
import { calcIgtf } from '@/shared/lib/paymentUtils'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { randomUUID, generateGiftCardCode } from '@/shared/lib/cryptoUtils'
import { OdooServerError } from '@/shared/lib/odooEnv'
import { enqueue as enqueueOrder, patchFiscal } from '@/shared/lib/orderQueue'
import { useCartStore } from '@/features/cart/stores/cart'

// ─── generic-partial-payment: Phase 0 decisions (locked before coding) ───────
//
// 0.1 — Legacy single-leg wrapping: design.md changes buildSaleOrderPayload's
// signature to (customer, cart, legs, attemptId, giftCard), but the LEGACY
// single-method path (non-VPOS test methods: cash/pago_movil/zelle/etc., and
// full-gift-card via SUBMIT_PAYMENT) keeps dispatching SUBMIT_PAYMENT
// UNCHANGED. `buildLegsInput` below wraps context.activePayment +
// context.selectedMethod into a synthetic one-element `legs` array ONLY at
// the actor-input-construction boundary (processing/enqueuingOffline/
// printing) — it is NEVER written into context.legs, which stays "VPOS legs
// only" per design Decision 1. This keeps the legacy path byte-identical.
// buildSaleOrderPayload itself is not touched here (Phase 2) — the `legs`
// field is added to actor inputs now so Phase 2's actor bodies can switch to
// consuming it without another saleMachine.ts change.
//
// 0.2 — VPOS partial-amount input UX (post-design user decision, not a
// saleMachine.ts concern): a new input (VposAmountInput, Phase 3) is
// pre-filled with the FULL remaining amount by default
// (`remainingAmount ?? total`), editable only DOWNWARD (max = remainder),
// never empty/free-form. Confirming without editing preserves today's
// behavior (full remainder, single closing VPOS leg). Feeds 3.3/3.4.
//
// 0.3 — Buying-a-new-gift-card-as-a-product branch (submitPaymentToOdoo's
// `cart.find(item => item.isGiftCard)` branch below — unrelated to
// giftCardLeg/paying-WITH-a-gift-card): once Phase 2 migrates
// buildSaleOrderPayload to accept `legs[]`, this branch must synthesize its
// own one-element `legs` array from its existing `payment`/`method` locals,
// out of scope for VPOS-split/cap logic. Not changed in this batch since
// buildSaleOrderPayload's signature is still the pre-Phase-2 one.
//
// ─── Phase 2 closure (2026-07-24) ────────────────────────────────────────────
// buildSaleOrderPayload/buildFacturaPayload now take `legs`/`tenders[]`.
// `buildLegsInput` below closes the gap flagged in 1.5's Deviation #1: actor
// bodies now consume `input.legs` instead of singular `payment`/`method`.
// It ALSO fixes a latent issue in the legacy (non-VPOS) single-leg synthesis
// that 1.5 deferred here: the pre-Phase-2 saleOrderPayload.ts/printPayload.ts
// NEVER read `activePayment.amount`/`igtfAmount` for the amount/IGTF fields —
// they always recomputed from cart+method (in Bs), specifically because
// `activePayment.amount` can be in a FOREIGN currency (USD) for methods with
// `currencyRate > 1` (see usePaymentAmounts.ts), while payments[].amount/
// fiscal tenders must ALWAYS be in Bs. `buildLegsInput` preserves that exact
// invariant — it recomputes baseBs/amountBs from `totalBsForRemainder` (a
// cart-based total passed by each call site using ITS OWN historical
// formula: saleOrderPayload's with-tax total for processing/enqueuingOffline,
// printPayload's no-tax total for printing) instead of trusting
// `activePayment.amount/igtfAmount` — this keeps both the legacy single-leg
// path AND the legacy gift-card-remainder path byte-identical to their
// pre-Phase-2 shipped numbers (see saleMachine.test.ts T4.1 / "printing
// wiring", which exercise the REAL, non-mocked actor bodies).

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SaleContext {
  customer: KioskPartner | null
  pendingVat: string | null         // cédula ingresada cuando no se encontró partner
  cart: CartItem[]
  requiredEngines: RequiredEngine[]  // motores de lealtad (ej. Promaker) que exige el carrito actual
  selectedMethod: KioskPaymentMethod | null
  activePayment: ActivePayment | null
  giftCard: GiftCard | null
  giftCardLeg: GiftCard | null       // leg de tarjeta de regalo ya confirmado (pago parcial 2-leg); persiste mientras se elige el segundo método
  remainingAmount: number | null     // saldo (en Bs) que debe cubrir el segundo método tras el consumo parcial de la gift card
  legs: PaymentLeg[]                 // piernas VPOS ya cobradas (generic-partial-payment); la gift card NO vive acá (design Decision 1)
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
  | { type: 'LOYALTY_DONE' }
  | { type: 'LOYALTY_SKIP' }
  | { type: 'PAY' }
  | { type: 'SELECT_METHOD'; method: KioskPaymentMethod }
  | { type: 'SUBMIT_PAYMENT'; payment: ActivePayment; giftCard?: GiftCard }
  | { type: 'GIFT_CARD_PARTIAL'; giftCard: GiftCard; remainingAmount: number }
  | { type: 'VPOS_LEG_PAID'; payment: ActivePayment; method: KioskPaymentMethod; baseBs: number }
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
  { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string; giftCard: GiftCard | null; legs: PaymentLeg[] }
>(async ({ input }) => {
  const { customer, cart, payment, method, attemptId, giftCard, legs } = input

  const giftCardItem = cart.find(item => item.isGiftCard)
  if (giftCardItem) {
    const code = generateGiftCardCode()
    const cardInfo = await assignCardFromSale({
      amount: giftCardItem.price,
      partner_id: customer.id,
      code: code
    })
    // 0.3: comprar una gift card COMO PRODUCTO (no pagar CON una) sintetiza
    // su propia pierna única a partir de payment/method — fuera del alcance
    // de cap/split VPOS, no pasa por buildLegsInput ni por context.legs.
    const productLeg: PaymentLeg = {
      method,
      baseBs: payment.amount - payment.igtfAmount,
      montoIgtf: payment.igtfAmount,
      amountBs: payment.amount,
      reference: payment.reference || '',
      ts: Date.now()
    }
    const payload = buildSaleOrderPayload(customer, cart, [productLeg], attemptId, {
      id: cardInfo.id,
      code: cardInfo.code,
      amount: cardInfo.amount,
      balance: cardInfo.balance,
      state: 'new'
    })
    return createSaleOrder(payload)
  }

  // Tarjeta de regalo como medio de pago (pago completo con -999, o el/los
  // legs de un pago parcial N-piernas) — buildSaleOrderPayload filtra
  // internamente las piernas con method.id === -999 (nunca van a payments[]).
  const payload = buildSaleOrderPayload(customer, cart, legs, attemptId, giftCard ?? null)
  return createSaleOrder(payload)
})

// Solo se invoca cuando submitPaymentToOdoo falló con un error DEFERRABLE
// (ver isDeferrableError). Construye el payload UNA vez y lo persiste
// verbatim: el synchronizer lo reenvía tal cual, nunca lo reconstruye
// (ver ADR-1/ADR-2 del design — evita drift de tasa/líneas que rompería
// la deduplicación por x_fex_id en el backend).
const enqueueOfflineOrder = fromPromise<
  unknown,
  { customer: KioskPartner; cart: CartItem[]; payment: ActivePayment; method: KioskPaymentMethod; attemptId: string; giftCard: GiftCard | null; legs: PaymentLeg[] }
>(async ({ input }) => {
  const { customer, cart, attemptId, giftCard, legs } = input
  // Bug fix (engram #423): el payload encolado offline debe llevar el mismo
  // giftCard leg que un envío online, para que el synchronizer lo reenvíe
  // verbatim (ver comentario arriba, sección Backend v19 residual-fill).
  const payload = buildSaleOrderPayload(customer, cart, legs, attemptId, giftCard)
  return enqueueOrder(attemptId, payload)
})

// Odoo devuelve OdooServerError para rechazos de negocio permanentes
// (crédito bloqueado, validación, etc.) — esos jamás deben encolarse offline.
// Cualquier otro Error (red, timeout, 5xx) se asume transitorio y se difiere.
function isDeferrableError(error: unknown): boolean {
  return !(error instanceof OdooServerError)
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// generic-partial-payment (0.1, cerrado en Fase 2): construye el array
// `legs` que consumen los actor inputs de processing/enqueuingOffline/
// printing. Si ya hay piernas VPOS acumuladas (context.legs) las usa tal
// cual — ya vienen con baseBs/amountBs/montoIgtf correctos desde `commitLeg`
// (calcIgtf real, monto confirmado por el cajero). Si no (camino legacy:
// SUBMIT_PAYMENT — método de un solo pago no-VPOS, o gift-card completa/
// parcial cerrada sin VPOS_LEG_PAID), sintetiza una pierna única — NUNCA
// escribe en context.legs.
//
// `totalBsForRemainder` es el total del carrito (sin IGTF) calculado por
// CADA call site con SU PROPIA fórmula histórica (con o sin IVA — ver
// comentario "Phase 2 closure" más arriba): la pierna legacy SIEMPRE
// recalcula baseBs/montoIgtf/amountBs desde cart+method, nunca desde
// activePayment.amount/igtfAmount directamente (ese valor puede venir en
// USD para métodos foráneos — ver usePaymentAmounts.ts). Si hay un
// giftCardLeg activo (pago parcial por el camino legacy, sin VPOS) y el
// método elegido no es la propia tarjeta (-999), el remanente es
// autoritativo y su IGTF se fuerza a 0 — decisión heredada de la
// implementación pre-Fase-2 (ver design.md Open Questions), preservada
// byte a byte.
function buildLegsInput(context: SaleContext, totalBsForRemainder: number): PaymentLeg[] {
  if (context.legs.length > 0) return context.legs
  if (!context.activePayment || !context.selectedMethod) return []
  const { activePayment, selectedMethod } = context

  if (context.giftCardLeg && selectedMethod.id !== -999) {
    const globalRate = useExchangeRateStore.getState().rate || 1
    const remainderBs = round2(totalBsForRemainder - context.giftCardLeg.amount * globalRate)
    return [{
      method: selectedMethod,
      baseBs: remainderBs,
      montoIgtf: 0,
      amountBs: remainderBs,
      reference: activePayment.reference || '',
      ts: Date.now()
    }]
  }

  const igtfBs = selectedMethod.applyIgtf ? totalBsForRemainder * (selectedMethod.igtfPercent / 100) : 0
  return [{
    method: selectedMethod,
    baseBs: round2(totalBsForRemainder),
    montoIgtf: round2(igtfBs),
    amountBs: round2(totalBsForRemainder + igtfBs),
    reference: activePayment.reference || '',
    ts: Date.now()
  }]
}

const printFiscalInvoice = fromPromise<
  PrinterInvoiceData,
  { customer: KioskPartner; cart: CartItem[]; method: KioskPaymentMethod; payment: ActivePayment; printerUrl: string; printerModel: string; giftCard: GiftCard | null; legs: PaymentLeg[] }
>(async ({ input, signal }) => {
  const { customer, cart, printerUrl, printerModel, giftCard, legs } = input
  const printer = new FiscalPrinterAdapter(printerUrl, printerModel)

  const isGiftCardPurchase = cart.some(item => item.isGiftCard)
  if (isGiftCardPurchase && giftCard) {
    const items = [
      noFiscalItem("==================================", "C"),
      noFiscalItem("TARJETA DE REGALO", "C"),
      noFiscalItem("==================================", "C"),
      noFiscalItem("Cliente: " + customer.name),
      noFiscalItem("C.I: " + customer.cedula),
      noFiscalItem("Monto: USD " + giftCard.amount.toFixed(2)),
      noFiscalItem("Codigo: " + giftCard.code),
      noFiscalItem("----------------------------------"),
      noFiscalItem(giftCard.code, "B"),
      noFiscalItem("==================================", "C")
    ]
    const response = await printer.printNoFiscal(items, signal)
    return {
      code: String(response.numNota || response.numfactura || ''),
      date: `${response.fecha} ${response.hora}`.trim(),
      serial: response.serial
    }
  }

  // generic-partial-payment / fiscal-tender-code-mapping: `tenders[]` se
  // construye ACÁ (el caller, per design.md) a partir de `legs[]` (código
  // real `printerCode` por pierna; una pierna con method.id === -999 usa el
  // código fijo de tarjeta de regalo) + el leg de gift card PARCIAL
  // (`giftCard`) cuando no está ya representado como una pierna -999 (pago
  // completo con tarjeta, camino legacy) — evita duplicar el monto de la
  // tarjeta. `buildFacturaPayload` explota si algún tender llega sin código
  // real (nunca default).
  const hasFullGiftCardLeg = legs.some(l => l.method.id === -999)
  const tenders: Tender[] = legs.map(l => ({
    code: l.method.id === -999 ? GIFT_CARD_TENDER_CODE : (l.method.printerCode || ''),
    amountBs: l.amountBs,
    igtfBs: l.montoIgtf
  }))
  if (giftCard && !hasFullGiftCardLeg) {
    const globalRate = useExchangeRateStore.getState().rate || 1
    tenders.push({
      code: GIFT_CARD_TENDER_CODE,
      amountBs: round2(giftCard.amount * globalRate),
      igtfBs: 0
    })
  }

  const payload = buildFacturaPayload(
    customer.name,
    customer.cedula,
    cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, taxRate: i.taxRate })),
    tenders,
    'Autopago'
  )
  const response = await printer.printFactura(payload as Record<string, unknown>, signal)
  return {
    code: String(response.numfactura || response.numNota || ''),
    date: `${response.fecha} ${response.hora}`.trim(),
    serial: response.serial
  }
})

// validateLoyalty ya degrada graciosamente a [] ante cualquier error (modelo
// inexistente, red caída): jamás debe bloquear la venta.
const checkLoyalty = fromPromise<RequiredEngine[], { partnerId: number; productIds: number[] }>(
  async ({ input }) => validateLoyalty(input.partnerId, input.productIds)
)

// ─── Machine ──────────────────────────────────────────────────────────────────

export const saleMachine = setup({
  types: { context: {} as SaleContext, events: {} as SaleEvent },
  actors: { submitPaymentToOdoo, printFiscalInvoice, countdownTick, enqueueOfflineOrder, checkLoyalty },
  guards: {
    isDeferrable: ({ event }) => isDeferrableError((event as { error?: unknown }).error),
    hasRequiredEngines: ({ event }) => {
      const output = (event as { output?: RequiredEngine[] }).output
      return Array.isArray(output) && output.length > 0
    },
    // generic-partial-payment: decide si la pierna VPOS que se acaba de
    // cobrar cierra la venta (processing) o vuelve a selectingMethod (loop).
    // remainingAmount ya debe estar seteado por un GIFT_CARD_PARTIAL previo o
    // por una pierna VPOS anterior en el mismo loop. Decisión explícita de
    // esta iteración (documentada, no silenciosa — ver tasks.md 1.5): si es
    // null (primera pierna VPOS de una venta SIN gift card y sin piernas
    // previas), esta pierna es por definición el monto que el cajero confirmó
    // para cerrar (Fase 3/VposAmountInput clampan ese monto contra el
    // remanente real en la UI, fuera de este work unit) — tratarla como
    // "cubre completo" preserva el cierre inmediato de una venta VPOS de un
    // solo método (regresión, Scenario "Single VPOS-only sale unaffected").
    coversRemaining: ({ context, event }) => {
      const e = event as Extract<SaleEvent, { type: 'VPOS_LEG_PAID' }>
      return context.remainingAmount === null || e.baseBs >= context.remainingAmount
    }
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
    setRequiredEngines: assign({
      requiredEngines: ({ event }) => (event as { output?: RequiredEngine[] }).output ?? []
    }),
    clearRequiredEngines: assign({ requiredEngines: [] }),
    setMethod: assign({
      selectedMethod: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'SELECT_METHOD' }>).method
    }),
    setPayment: assign({
      activePayment: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'SUBMIT_PAYMENT' }>).payment,
      giftCard: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'SUBMIT_PAYMENT' }>).giftCard ?? null
    }),
    // Pago parcial con tarjeta de regalo (2-leg): persiste el leg ya
    // confirmado + el remanente en Bs, y vuelve a selectingMethod para elegir
    // el segundo método. NO toca activePayment/giftCard (esos son del leg 2).
    setGiftCardLeg: assign({
      giftCardLeg: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'GIFT_CARD_PARTIAL' }>).giftCard,
      remainingAmount: ({ event }) =>
        (event as Extract<SaleEvent, { type: 'GIFT_CARD_PARTIAL' }>).remainingAmount
    }),
    // generic-partial-payment: push de la pierna VPOS recién cobrada +
    // decremento del remanente. IGTF real por pierna (calcIgtf), nunca
    // hardcodeado (spec "IGTF Calculated Per Leg"). Si remainingAmount era
    // null (ver guard coversRemaining), esta pierna decrementa desde su
    // propio baseBs -> remainingAmount termina en 0 (cierra).
    commitLeg: assign(({ context, event }) => {
      const e = event as Extract<SaleEvent, { type: 'VPOS_LEG_PAID' }>
      const montoIgtf = calcIgtf(e.method, e.baseBs)
      const leg: PaymentLeg = {
        method: e.method,
        baseBs: e.baseBs,
        montoIgtf,
        amountBs: e.baseBs + montoIgtf,
        reference: e.payment.reference || '',
        ts: Date.now()
      }
      const base = context.remainingAmount ?? e.baseBs
      return {
        legs: [...context.legs, leg],
        remainingAmount: Math.max(0, base - e.baseBs)
      }
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
    resetContext: assign(() => {
      try {
        useCartStore.getState().clearCart()
      } catch (err) {
        console.error('Error clearing cart store in resetContext:', err)
      }
      return {
        customer: null,
        pendingVat: null,
        cart: [],
        requiredEngines: [],
        selectedMethod: null,
        activePayment: null,
        giftCard: null,
        giftCardLeg: null,
        remainingAmount: null,
        legs: [],
        saleAttemptId: null,
        odooOrderId: null,
        queuedOffline: false,
        printerResult: null,
        errorMessage: null,
        printError: null,
        countdown: 0
      }
    })
  }
}).createMachine({
  id: 'sale',
  initial: 'idle',
  context: {
    customer: null,
    pendingVat: null,
    cart: [],
    requiredEngines: [],
    selectedMethod: null,
    activePayment: null,
    giftCard: null,
    giftCardLeg: null,
    remainingAmount: null,
    legs: [],
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
        CHECKOUT: { target: 'checkingLoyalty', actions: 'setCart' },
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    reviewingCart: {
      on: {
        PAY: 'checkingLoyalty',
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    // Consulta si el carrito activa algún motor de lealtad (ej. Promaker).
    // Degradación graciosa: cualquier falla se resuelve como "sin motores" y
    // sigue directo al pago — la lealtad nunca bloquea una venta.
    checkingLoyalty: {
      invoke: {
        src: 'checkLoyalty',
        input: ({ context }) => ({
          partnerId: context.customer?.id ?? 0,
          productIds: context.cart.map((item) => item.productId)
        }),
        onDone: [
          { guard: 'hasRequiredEngines', target: 'loyaltyRequired', actions: 'setRequiredEngines' },
          { target: 'selectingMethod', actions: 'clearRequiredEngines' }
        ],
        onError: { target: 'selectingMethod', actions: 'clearRequiredEngines' }
      },
      on: {
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    // El carrito exige registrar/confirmar una o más tarjetas de lealtad
    // antes de continuar. La pantalla de lealtad resuelve el registro
    // (o el "omitir" del operador) contra Odoo y notifica el resultado acá.
    loyaltyRequired: {
      on: {
        LOYALTY_DONE: { target: 'selectingMethod', actions: 'clearRequiredEngines' },
        LOYALTY_SKIP: { target: 'selectingMethod', actions: 'clearRequiredEngines' },
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
        // Pago parcial con tarjeta de regalo (balance < total): guarda el leg
        // ya confirmado + el remanente, y vuelve a selectingMethod para que
        // el cajero elija el segundo método que cubra remainingAmount.
        GIFT_CARD_PARTIAL: { target: 'selectingMethod', actions: 'setGiftCardLeg' },
        // generic-partial-payment: cobro VPOS confirmado. Si cubre el
        // remanente (coversRemaining) cierra (processing); si no, vuelve a
        // selectingMethod para la siguiente pierna. Ambas ramas ejecutan
        // commitLeg (push + decremento de remainingAmount) — GIFT_CARD_PARTIAL
        // arriba queda intacto (loop incondicional, nunca cierra).
        VPOS_LEG_PAID: [
          { guard: 'coversRemaining', target: 'processing', actions: 'commitLeg' },
          { target: 'selectingMethod', actions: 'commitLeg' }
        ],
        SELECT_METHOD: { target: 'enteringDetails', actions: 'setMethod' },
        BACK: 'selectingMethod',
        RESET: { target: 'idle', actions: 'resetContext' }
      }
    },

    processing: {
      invoke: {
        src: 'submitPaymentToOdoo',
        input: ({ context }) => {
          // generic-partial-payment (0.1): una venta cerrada por VPOS_LEG_PAID
          // nunca pasa por setPayment/setMethod (esos campos son del camino
          // legacy) — solo exige customer/saleAttemptId + AL MENOS un origen
          // de pago (activePayment+selectedMethod legacy, o legs[] VPOS).
          const hasLegacyPayment = context.activePayment && context.selectedMethod
          const hasLegs = context.legs.length > 0
          if (!context.customer || !context.saleAttemptId || (!hasLegacyPayment && !hasLegs)) {
            throw new Error('Estado inválido: falta customer, payment/method o attemptId')
          }
          // Fórmula histórica de saleOrderPayload.ts (con IVA) — ver comentario
          // "Phase 2 closure" arriba de buildLegsInput.
          const totalBs = context.cart.reduce((sum, item) => sum + item.subtotal * (1 + item.taxRate), 0)
          return {
            customer: context.customer,
            cart: context.cart,
            payment: context.activePayment as ActivePayment,
            method: context.selectedMethod as KioskPaymentMethod,
            attemptId: context.saleAttemptId,
            // giftCardLeg (pago parcial N-piernas) tiene prioridad sobre giftCard
            // (pago completo -999); ambos son mutuamente excluyentes en la práctica.
            giftCard: context.giftCardLeg ?? context.giftCard,
            legs: buildLegsInput(context, totalBs)
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
          // Ver comentario equivalente en `processing` (0.1): un cierre por
          // VPOS_LEG_PAID nunca pasa por setPayment/setMethod.
          const hasLegacyPayment = context.activePayment && context.selectedMethod
          const hasLegs = context.legs.length > 0
          if (!context.customer || !context.saleAttemptId || (!hasLegacyPayment && !hasLegs)) {
            throw new Error('Estado inválido: falta customer, payment/method o attemptId')
          }
          // Misma fórmula que `processing` — el payload offline debe llegar
          // idéntico al que hubiera generado el camino online equivalente.
          const totalBs = context.cart.reduce((sum, item) => sum + item.subtotal * (1 + item.taxRate), 0)
          return {
            customer: context.customer,
            cart: context.cart,
            payment: context.activePayment as ActivePayment,
            method: context.selectedMethod as KioskPaymentMethod,
            attemptId: context.saleAttemptId,
            // Bug fix (engram #423): faltaba pasar el giftCard leg al encolar
            // offline — el replay reconstruía el payload sin el leg de tarjeta.
            giftCard: context.giftCardLeg ?? context.giftCard,
            legs: buildLegsInput(context, totalBs)
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
          const hasLegacyPayment = context.activePayment && context.selectedMethod
          const hasLegs = context.legs.length > 0
          if (!context.customer || (!hasLegacyPayment && !hasLegs)) {
            throw new Error('Estado inválido: falta customer o payment/method')
          }
          // Fórmula histórica de printPayload.ts (SIN IVA) — ver comentario
          // "Phase 2 closure" arriba de buildLegsInput. Distinta a propósito
          // de la de `processing`/`enqueuingOffline` (con IVA): preserva el
          // comportamiento pre-Fase-2, no lo unifica (fuera de este alcance).
          const totalBs = context.cart.reduce((sum, item) => sum + item.subtotal, 0)
          return {
            customer: context.customer,
            cart: context.cart,
            method: context.selectedMethod as KioskPaymentMethod,
            payment: context.activePayment as ActivePayment,
            printerUrl: useConfigStore.getState().printerUrl,
            printerModel: useConfigStore.getState().printerModel,
            giftCard: context.giftCardLeg ?? context.giftCard,
            legs: buildLegsInput(context, totalBs)
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
