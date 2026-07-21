import { odooEnv } from '@/shared/lib/odooEnv'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

export interface RequiredEngine {
  engine_code: string
  engine_name: string
  message: string
  regex: string
  api_endpoint: string
  api_key: string
  customer_has_card: boolean
  current_card_code: string
  trigger_products: { id: number | null; external_sku: string }[]
}

interface ValidateLoyaltyResponse {
  status: string
  required_engines: RequiredEngine[]
}

export interface RegisterCardResponse {
  ok: boolean
  error?: string
  message?: string
  data?: {
    id: number
    card_code: string
    engine_code: string
    created?: boolean
    updated?: boolean
  }
}

// ─── x.promo.external.engine ──────────────────────────────────────────────────

/**
 * Determina qué motores de lealtad (ej. Promaker) exige el carrito actual.
 * Degradación graciosa: si Odoo no tiene el módulo instalado o falla la red,
 * nunca debe bloquear la venta — se retorna sin motores requeridos.
 */
export async function validateLoyalty(partnerId: number, productIds: number[]): Promise<RequiredEngine[]> {
  if (!partnerId || !productIds.length) return []

  try {
    const result = await odooEnv.callMethod<ValidateLoyaltyResponse>(
      'x.promo.external.engine',
      'action_validate_loyalty',
      [partnerId, productIds]
    )
    if (result?.status !== 'ok') return []
    return Array.isArray(result.required_engines) ? result.required_engines : []
  } catch (err) {
    console.error('[promoRepository] Error validando lealtad, se omite:', err)
    return []
  }
}

// ─── x.promo.partner.loyalty.card ─────────────────────────────────────────────

export async function registerLoyaltyCard(
  partnerId: number,
  engineCode: string,
  cardCode: string
): Promise<RegisterCardResponse> {
  try {
    const result = await odooEnv.callMethod<RegisterCardResponse>(
      'x.promo.partner.loyalty.card',
      'action_register_card',
      [partnerId, engineCode, cardCode]
    )
    return result ?? { ok: false, error: 'EMPTY_RESPONSE' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[promoRepository] Error registrando tarjeta de lealtad:', message)
    return { ok: false, error: 'ERR_NETWORK_RPC', message }
  }
}

interface CheckCardExistsResponse {
  found: boolean
  degraded?: boolean
}

/**
 * Verifica si una tarjeta existe en el sistema externo de promociones.
 * Se resuelve server-to-server vía Odoo (x.promo.external.engine.action_check_card_exists)
 * en vez de hacer fetch directo al navegador: la API externa (ej. clubpromaker)
 * no habilita CORS para el origen del kiosco, y así tampoco se expone el
 * api_key del motor al cliente.
 */
export async function checkLoyaltyCardExists(
  engineCode: string,
  cardCode: string,
  branchId?: number
): Promise<CheckCardExistsResponse> {
  try {
    const result = await odooEnv.callMethod<CheckCardExistsResponse>(
      'x.promo.external.engine',
      'action_check_card_exists',
      [engineCode, cardCode, branchId || false]
    )
    return result ?? { found: true, degraded: true }
  } catch (err) {
    console.error('[promoRepository] Error verificando tarjeta, se omite:', err)
    return { found: true, degraded: true }
  }
}
