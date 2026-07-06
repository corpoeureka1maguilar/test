import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// autopay todavía no integra pago con tarjeta (Megasoft/VPos ni Instapago) — hoy
// solo maneja pago por referencia manual (ver PaymentForm.tsx). Este archivo NO
// agrega ningún cliente de producción: documenta como spec ejecutable el contrato
// HTTP real observado en eu_fex_ppal (src/renderer/src/store/payment.ts y
// plugins/composables.ts) para que, cuando se implemente el cliente acá, este
// test defina el comportamiento esperado.

type FetchMock = ReturnType<typeof vi.fn>

// ─── Megasoft / VPos ────────────────────────────────────────────────────────
// Servicio HTTP local fijo (payment.ts:141) — no configurable por método de pago.

const VPOS_BASE_URL = 'http://localhost:8085/vpos/'

interface VPosRequest {
  accion: 'tarjeta' | 'cambio' | 'creacionCashea' | 'cancelacionCashea' | 'confirmacionCashea' | string
  cedula?: string
  montoTransaccion?: string
}

interface VposResponse {
  codRespuesta: string
  mensajeRespuesta: string
  numeroReferencia?: string
}

// payment.ts:_getVposMethod — "Cashea" en la acción cambia el endpoint
function vposEndpointFor(accion: string): string {
  return accion.toLowerCase().includes('cashea') ? `${VPOS_BASE_URL}metodo_cashea` : `${VPOS_BASE_URL}metodo`
}

// payment.ts:508-516 (wasPaymentRequestSuccessful) — comentario original: "las
// respuestas de merchant son muy ambiguas, no hay forma de saber diferenciar
// éxito de fracaso". Éxito = mensaje contiene "cancela" O código matchea /^[0-1]{2}$/
function wasPaymentRequestSuccessful(codRespuesta: string, mensajeRespuesta: string): boolean {
  return mensajeRespuesta.toLowerCase().includes('cancela') || /^[0-1]{2}$/.test(codRespuesta)
}

// payment.ts:484-490 (_parseAmount) — el monto viaja como centavos sin punto decimal
function parseVposAmount(raw: string): number {
  const padded = raw.padStart(3, '0')
  const cents = padded.slice(-2)
  const whole = padded.slice(0, -2)
  return Number(`${whole}.${cents}`)
}

describe('Megasoft / VPos — contrato HTTP', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('el chequeo de conexión pega a GET {base}ping', async () => {
    const fetchMock = fetch as unknown as FetchMock
    fetchMock.mockResolvedValueOnce({ ok: true })

    const res = await fetch(`${VPOS_BASE_URL}ping`)

    expect(fetchMock).toHaveBeenCalledWith(`${VPOS_BASE_URL}ping`)
    expect(res.ok).toBe(true)
  })

  it('un pago con tarjeta pega a POST {base}metodo con el VPosRequest', async () => {
    const fetchMock = fetch as unknown as FetchMock
    const request: VPosRequest = { accion: 'tarjeta', cedula: 'V12345678', montoTransaccion: '10000' }
    const response: VposResponse = { codRespuesta: '00', mensajeRespuesta: 'Aprobado', numeroReferencia: '000123' }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => response })

    const endpoint = vposEndpointFor(request.accion)
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(request)
    })

    expect(endpoint).toBe(`${VPOS_BASE_URL}metodo`)
    expect(fetchMock).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(request)
    })
  })

  it('las operaciones Cashea (creacion/cancelacion/confirmacion) pegan a POST {base}metodo_cashea', () => {
    expect(vposEndpointFor('creacionCashea')).toBe(`${VPOS_BASE_URL}metodo_cashea`)
    expect(vposEndpointFor('cancelacionCashea')).toBe(`${VPOS_BASE_URL}metodo_cashea`)
    expect(vposEndpointFor('confirmacionCashea')).toBe(`${VPOS_BASE_URL}metodo_cashea`)
    expect(vposEndpointFor('cambio')).toBe(`${VPOS_BASE_URL}metodo`)
  })

  it.each([
    ['00', 'Aprobado', true],
    ['01', 'Aprobado', true],
    ['05', 'Rechazado', false],
    ['05', 'Transacción cancelada por el usuario', true],
    ['99', 'Error', false]
  ])('codRespuesta=%s mensaje="%s" → éxito=%s', (cod, msg, expected) => {
    expect(wasPaymentRequestSuccessful(cod, msg)).toBe(expected)
  })

  it.each([
    ['10000', 100],
    ['500', 5],
    ['5', 0.05]
  ])('parsea el monto en centavos "%s" → %s', (raw, expected) => {
    expect(parseVposAmount(raw)).toBeCloseTo(expected)
  })
})

// ─── Instapago ──────────────────────────────────────────────────────────────
// A diferencia de VPos, el host y puerto vienen por método de pago (Odoo:
// pos_instapago_url / pos_instapago_port), no son fijos.

interface InstapagoInitialData {
  tipoCuenta: 'CORRIENTE' | 'AHORROS' | 'CREDITO'
  cedula: string
  numeroOrden: string
  mensaje: string
  monto: number
}

interface InstapagoTransactionPayload {
  operacion: 'COMPRA'
  monto: number
  tipoCuenta: string
  cedula: string
  numeroOrden: string
  mensaje: string
}

interface InstapagoVposResponse {
  success: boolean
  message: string
  ordernumber?: string
  responsecode?: string
}

function instapagoEndpoint(url: string, port: number): string {
  return `${url}:${port}/transaction`
}

// composables.ts:759-788 (generateInstapagoCardEndpointAndPayload) — OJO: el
// `mensaje` real que arma la UI se descarta y siempre se manda hardcodeado
// como 'Mensaje de prueba'. Se documenta acá tal cual está en producción.
function buildInstapagoPayload(data: InstapagoInitialData): InstapagoTransactionPayload {
  return {
    operacion: 'COMPRA',
    monto: Math.round(data.monto * 100),
    tipoCuenta: data.tipoCuenta,
    cedula: data.cedula,
    numeroOrden: data.numeroOrden,
    mensaje: 'Mensaje de prueba'
  }
}

// composables.ts:790-825 (sendInstapagoRequest)
function wasInstapagoSuccessful(status: number, result: InstapagoVposResponse): boolean {
  return [200, 201].includes(status) && result.success
}

describe('Instapago — contrato HTTP', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('arma el endpoint desde host:puerto configurados por método de pago', () => {
    expect(instapagoEndpoint('http://192.168.1.50', 8090)).toBe('http://192.168.1.50:8090/transaction')
  })

  it('el mensaje ingresado por el usuario se ignora y se manda hardcodeado (bug documentado en producción)', () => {
    const data: InstapagoInitialData = {
      tipoCuenta: 'CORRIENTE',
      cedula: 'V12345678',
      numeroOrden: 'ORD-1',
      mensaje: 'Compra por Fex',
      monto: 12.34
    }

    const payload = buildInstapagoPayload(data)

    expect(payload.mensaje).toBe('Mensaje de prueba')
    expect(payload.monto).toBe(1234)
  })

  it('POST {host}:{puerto}/transaction con el body esperado por el terminal', async () => {
    const fetchMock = fetch as unknown as FetchMock
    const endpoint = instapagoEndpoint('http://192.168.1.50', 8090)
    const payload = buildInstapagoPayload({
      tipoCuenta: 'AHORROS',
      cedula: 'V87654321',
      numeroOrden: 'ORD-2',
      mensaje: 'irrelevante',
      monto: 50
    })
    const response: InstapagoVposResponse = { success: true, message: 'Aprobado', ordernumber: 'MOCK-1', responsecode: '00' }
    fetchMock.mockResolvedValueOnce({ status: 200, json: async () => response })

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Host: '192.168.1.50', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const body = await res.json()

    expect(fetchMock).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: { Host: '192.168.1.50', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(wasInstapagoSuccessful(res.status, body)).toBe(true)
  })

  it.each([
    [200, { success: true, message: 'ok' }, true],
    [201, { success: true, message: 'ok' }, true],
    [200, { success: false, message: 'rechazado' }, false],
    [500, { success: true, message: 'ok' }, false]
  ])('status=%s success=%s → resultado=%s', (status, result, expected) => {
    expect(wasInstapagoSuccessful(status, result as InstapagoVposResponse)).toBe(expected)
  })
})
