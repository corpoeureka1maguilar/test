import type { PrinterApiResponse } from '@/shared/types/types'

// Base del proxy de impresión.
// - Dev: vacío → URL relativa → middleware de Vite (mismo origen).
// - Prod (Vercel): http://localhost:9191 → agente local en la máquina del cajero.
const PRINTER_PROXY_BASE = import.meta.env.VITE_PRINTER_PROXY_BASE ?? 'http://localhost:9191'

const getPrinterErrorMessage = (errorCode: string | object): string => {
  if (!errorCode) return 'Error desconocido de la impresora'
  if (typeof errorCode === 'object') return `Error de impresora: ${JSON.stringify(errorCode)}`

  const code = String(errorCode).trim().toUpperCase()
  const errorMessages: Record<string, string> = {
    NP: 'Impresora desconectada o puerto no disponible.',
    TO: 'Tiempo de espera agotado. La impresora no responde.',
    TIMEOUT: 'Tiempo de espera agotado. La impresora no responde.',
    NC: 'No hay comunicación con la impresora.',
    PO: 'Puerto ocupado por otra aplicación.',
    ER: 'Error general de la impresora.'
  }
  return errorMessages[code] ?? `Error de impresora: ${errorCode}`
}

export class FiscalPrinterAdapter {
  constructor(private readonly printerUrl: string, private readonly modelo?: string) { }

  private getProxyUrlAndHeaders(endpoint: string): { url: string; headers: Record<string, string> } {
    const hasProtocol = this.printerUrl.startsWith('http://') || this.printerUrl.startsWith('https://')

    // Siempre vía proxy: relativo en dev (middleware de Vite) o el agente
    // local en prod (VITE_PRINTER_PROXY_BASE). El proxy es quien resuelve CORS.
    if (hasProtocol) {
      return {
        url: `${PRINTER_PROXY_BASE}/printer-proxy/${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'x-printer-target': this.printerUrl
        }
      }
    }

    // Fallback: URL sin protocolo, intento directo (no debería ocurrir).
    const baseUrl = this.printerUrl.endsWith('/') ? this.printerUrl : this.printerUrl + '/'
    return {
      url: new URL(endpoint, baseUrl).toString(),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }

  async checkConnection(): Promise<void> {
    const { url, headers } = this.getProxyUrlAndHeaders('Estado')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await window.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(this.modelo ? { modelo: this.modelo } : {}),
        signal: controller.signal
      })

      if (!response.ok) throw new Error('La impresora no respondió correctamente')

      const status = await response.json()
      if (status.error) throw new Error(getPrinterErrorMessage(status.error))

      const hasValidResponse =
        Object.prototype.hasOwnProperty.call(status, 'Estado') ||
        Object.prototype.hasOwnProperty.call(status, 'serial') ||
        Object.prototype.hasOwnProperty.call(status, 'indimpresion')

      if (!hasValidResponse) throw new Error('La impresora no devolvió una respuesta válida')

      console.info('[FiscalPrinter] Conexión OK, serial:', status.serial || 'N/A')
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') throw new Error('Tiempo de espera agotado al conectar')
      throw new Error((e as Error)?.message ?? 'No se pudo establecer conexión con la impresora')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async sendRequest(endpoint: string, data: Record<string, unknown>, signal?: AbortSignal): Promise<PrinterApiResponse> {
    const { url, headers } = this.getProxyUrlAndHeaders(endpoint)

    console.debug(`[FiscalPrinter] POST ${url}`, data)

    try {
      const payload = this.modelo ? { modelo: this.modelo, ...data } : data
      const response = await window.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }

      const raw = await response.json()
      const status = this.normalizeResponse(raw)

      if (status.error) throw new Error(getPrinterErrorMessage(status.error as unknown as string))

      const hasValidData = status.numfactura || status.fecha || status.numNota || status.numReporte
      if (!hasValidData) throw new Error('La impresora no devolvió los datos esperados.')

      return status
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') throw e
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar al servicio de impresión. Verifique la conexión.')
      }
      throw new Error((e as Error)?.message ?? 'Error al comunicarse con la impresora.')
    }
  }

  async printFactura(data: Record<string, unknown>): Promise<PrinterApiResponse> {
    return this.sendRequest('PrintFactura', data)
  }

  async printNotaCredito(data: Record<string, unknown>): Promise<PrinterApiResponse> {
    return this.sendRequest('PrintNotadeCredito', data)
  }

  async printNotaDebito(data: Record<string, unknown>): Promise<PrinterApiResponse> {
    return this.sendRequest('PrintNotadeDebito', data)
  }

  private normalizeResponse(response: Record<string, unknown>): PrinterApiResponse {
    const findValue = (keys: string[]): unknown => {
      for (const key of keys) {
        if (response[key] !== undefined) return response[key]
        const lowerKey = key.toLowerCase()
        const foundKey = Object.keys(response).find(k => k.toLowerCase() === lowerKey)
        if (foundKey && response[foundKey] !== undefined) return response[foundKey]
      }
      return undefined
    }

    return {
      numfactura: findValue(['numfactura', 'NumFactura', 'factura', 'last_invoice_number']) as string | undefined,
      numNota: findValue(['numNota', 'NumNota', 'nota']) as string | undefined,
      numReporte: findValue(['numReporte', 'NumReporte', 'reporte']) as string | undefined,
      fecha: (findValue(['fecha', 'Fecha', 'date']) as string) || '',
      hora: (findValue(['hora', 'Hora', 'time']) as string) || '',
      serial: (findValue(['serial', 'Serial', 'nro_serial']) as string) || '',
      indimpresion: (findValue(['indimpresion', 'Indimpresion']) as string) || '',
      error: findValue(['error', 'Error']) as Record<string, unknown> | undefined
    }
  }
}
