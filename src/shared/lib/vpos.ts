// Cliente VPOS para pre-cierre/cierre de lote Megasoft, espejo de
// sendCierreVpos + _checkVposConnection + wasVposCierreSuccessful de
// eu_fex_ppal/src/renderer/src/store/payment.ts. Independiente del VPOS de
// pagos (useVposCheckout.ts) para no tocar el flujo de cobro ya en
// producción — mismo VPOS_BASE_URL, pero cliente propio.
const VPOS_BASE_URL = 'http://localhost:8085/vpos/'

export type VposCierreAccion = 'precierre' | 'cierre'

export interface VposResponse {
  codRespuesta: string
  mensajeRespuesta: string
  nombreVoucher: string
  [key: string]: unknown
}

// Mismo criterio que wasVposCierreSuccessful en ppal: los cierres de lote
// responden "00" o un código que arranca con "K" (distinto del código de
// éxito genérico de pagos con tarjeta).
export const wasVposCierreSuccessful = (code: string): boolean =>
  code.startsWith('K') || code === '00'

async function pingVpos(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${VPOS_BASE_URL}ping`, { signal })
  if (!response.ok) throw new Error('No se pudo establecer conexión con el servicio VPOS')
}

// Devuelve null si el VPOS no está disponible (ping falló) — el caller
// decide qué hacer (en ppal: marcar merchantNotAvailable sin bloquear el
// reintento), en vez de lanzar, para distinguir "no disponible" de "error
// de negocio" (código de respuesta no exitoso, que si se lanza como error).
export async function sendCierreVpos(accion: VposCierreAccion, signal?: AbortSignal): Promise<VposResponse | null> {
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    await pingVpos(controller.signal)
  } catch {
    return null
  } finally {
    signal?.removeEventListener('abort', onExternalAbort)
  }

  const response = await fetch(`${VPOS_BASE_URL}metodo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ accion }),
    signal: signal ?? null
  })

  if (!response.ok) throw new Error('El servicio VPOS respondió con un error')
  return (await response.json()) as VposResponse
}
