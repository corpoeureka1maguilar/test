import { odooEnv } from '@/shared/lib/odooEnv'

// ─── Métricas del kiosco ───────────────────────────────────────────────────────

// Envía el snapshot acumulado de métricas (ver shared/lib/metrics.ts) a Odoo,
// donde se guarda como jsonb (upsert por estación, ver x.pos.kiosk.metric)
export async function syncMetrics(stationId: number, branchId: number, metadata: unknown): Promise<void> {
  await odooEnv.callMethod(
    'x.pos.kiosk.metric', 'action_report_metrics',
    [stationId, metadata, branchId || null]
  )
}
