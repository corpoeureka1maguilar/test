import { odooEnv } from '@/shared/lib/odooEnv'

// ─── Totales de sesión de caja ─────────────────────────────────────────────────
// Mismos 3 endpoints que usa eu_fex_ppal/src/renderer/src/store/cash.ts
// (fetchCurrentSessionCash + fetchCurrentSessionTotals) para armar el ticket
// no fiscal de "Cierre de Turno".

export interface SessionCashTotals {
  totalCashBalance: number
  totalCashBalanceRef: number
}

export interface SessionPaymentMethodTotal {
  id: number
  method: string
  total: number
  total_ref: number
}

// Claves esperadas: total, totalCredit, totalCash, totalCashApertura,
// totalRefund, totalRetenido (ver SessionTotals en cash.ts de eu_fex_ppal)
export type SessionAmountTotals = Record<string, number>

export async function fetchSessionCashTotals(sessionId: number): Promise<SessionCashTotals> {
  return odooEnv.callMethod<SessionCashTotals>(
    'x.pos.session',
    'action_get_cash_totals',
    [sessionId]
  )
}

// Recalcula los totales en el backend antes de leerlos: sin este paso,
// action_get_totals_by_query puede devolver montos desactualizados (mismo
// orden que fetchCurrentSessionTotals en eu_fex_ppal). No abortable: es un
// recálculo de escritura, cancelarlo a mitad de camino dejaría datos a medio actualizar.
export async function recomputeSessionAmounts(sessionId: number): Promise<void> {
  await odooEnv.callMethod<unknown>(
    'x.pos.session.totals.report',
    'action_recompute_session_amounts',
    [sessionId],
    {},
    false
  )
}

export async function fetchSessionPaymentTotals(sessionId: number): Promise<SessionPaymentMethodTotal[]> {
  return odooEnv.callMethod<SessionPaymentMethodTotal[]>(
    'x.pos.session.totals.report',
    'action_get_totals_by_query',
    [sessionId]
  )
}

export async function fetchSessionAmountTotals(sessionId: number): Promise<SessionAmountTotals> {
  return odooEnv.callMethod<SessionAmountTotals>(
    'x.pos.session',
    'action_get_totals',
    [sessionId]
  )
}
