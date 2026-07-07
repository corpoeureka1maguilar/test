import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FiscalPrinterAdapter } from './fiscalPrinter'

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  }))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('FiscalPrinterAdapter — proxy routing', () => {
  it('routes requests with a protocol through the printer-proxy with the target header', async () => {
    mockFetchOnce({ numfactura: '001', fecha: '2026-06-30', hora: '10:00', serial: 'A1' })
    const printer = new FiscalPrinterAdapter('http://192.168.1.50:8080', 'EPSON')

    await printer.printFactura({ foo: 'bar' })

    expect(fetch).toHaveBeenCalledWith(
      '/printer-proxy/PrintFactura',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-printer-target': 'http://192.168.1.50:8080' })
      })
    )
  })
})

describe('FiscalPrinterAdapter — checkConnection', () => {
  // Paridad con fex: la nota de crédito necesita el serial de la impresora
  // conectada como `maquina` cuando la orden no lo tiene guardado; para eso
  // checkConnection devuelve el estado (con serial) en vez de void
  it('resolves with the printer status so callers can read the serial', async () => {
    mockFetchOnce({ Estado: 'OK', serial: 'A1' })
    const printer = new FiscalPrinterAdapter('http://printer.local', 'EPSON')
    await expect(printer.checkConnection()).resolves.toMatchObject({ serial: 'A1' })
  })

  it('throws a translated error message for a known printer error code', async () => {
    mockFetchOnce({ error: 'NP' })
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.checkConnection()).rejects.toThrow('Impresora desconectada o puerto no disponible.')
  })

  it('throws when the response has none of the expected status fields', async () => {
    mockFetchOnce({ foo: 'bar' })
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.checkConnection()).rejects.toThrow('La impresora no devolvió una respuesta válida')
  })

  it('throws when the HTTP response is not ok', async () => {
    mockFetchOnce({}, false)
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.checkConnection()).rejects.toThrow('La impresora no respondió correctamente')
  })
})

describe('FiscalPrinterAdapter — printFactura', () => {
  it('normalizes a response with capitalized keys', async () => {
    mockFetchOnce({ NumFactura: '00123', Fecha: '2026-06-30', Hora: '11:00', Serial: 'B2' })
    const printer = new FiscalPrinterAdapter('http://printer.local')

    const result = await printer.printFactura({ foo: 'bar' })

    expect(result).toMatchObject({ numfactura: '00123', fecha: '2026-06-30', hora: '11:00', serial: 'B2' })
  })

  it('throws when the printer returns an error field', async () => {
    mockFetchOnce({ error: 'TO' })
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.printFactura({})).rejects.toThrow('Tiempo de espera agotado. La impresora no responde.')
  })

  it('throws when the response has no recognizable invoice data', async () => {
    mockFetchOnce({ unrelated: true })
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.printFactura({})).rejects.toThrow('Hubo un error en la impresion por favor llama a un supervisor de la tienda')
  })

  it('translates a network failure into a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const printer = new FiscalPrinterAdapter('http://printer.local')
    await expect(printer.printFactura({})).rejects.toThrow('No se pudo conectar al servicio de impresión. Verifique la conexión.')
  })
})
