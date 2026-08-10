// Snapshot de admins de la sucursal para validar PINs sin conexión.
//
// El kiosco NO tiene PIN propio. La única fuente de verdad del password de
// administrador es `admin_password` del cajero en Odoo, y el permiso por
// operación es `pos_audit_operation_ids`. Con conexión eso lo resuelve
// `action_check_kiosk_admin`; sin conexión no hay a quién preguntarle, y por eso
// se cachea acá una copia del MISMO dato — passwords hasheados, permisos por
// operación, y el flag global de niveles — con vencimiento.
//
// Vencimiento y no caché permanente porque el snapshot no puede enterarse de
// una rotación de password ni de un permiso revocado mientras Odoo esté caído.
// El TTL lo manda Odoo (KIOSK_SNAPSHOT_TTL_MS en eu_autopay_bridge): 30 min
// desde el último refresh exitoso. Como el refresh corre cada
// REFRESH_INTERVAL_MS mientras hay conexión, en la práctica son 30 minutos de
// gracia contados desde que se cae la red.
//
// Toda aprobación resuelta acá se encola en AUDIT_QUEUE_STORE y se registra en
// x.pos.audit al reconectar: el snapshot no debe costar el rastro de auditoría.

import { iteratedHash, randomUUID } from './cryptoUtils'
import {
  ADMIN_SNAPSHOT_STORE,
  AUDIT_QUEUE_STORE,
  putCapped,
  getRecord,
  getAllRecords,
  deleteRecord,
  getInstanceKey
} from './idbStore'
import {
  fetchKioskAdminSnapshot,
  logKioskAudit,
  type KioskAdminSnapshot,
  type KioskAuditEntry,
  type KioskOperationRef
} from './odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'

// Muy por debajo del TTL de 30 min: si el refresh coincidiera con el
// vencimiento, un kiosco online tendría ventanas en las que el snapshot ya
// venció y la red todavía no se cayó — se quedaría sin validación offline
// justo en el instante en que la necesita.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

const SNAPSHOT_KIND = 'admins'

interface SnapshotRow extends KioskAdminSnapshot {
  kind: typeof SNAPSHOT_KIND
  // Lo estampa el kiosco, no Odoo: el TTL se mide siempre contra el mismo
  // reloj con el que después se compara, así una desincronización entre el
  // servidor y la caja no alarga ni acorta la vigencia.
  syncedAt: number
  instanceKey: string
}

export type OfflineAdminError = 'admin_not_found' | 'no_allowed' | 'snapshot_unavailable'

export interface OfflineAdminCheck {
  ok: boolean
  approverCashierId?: number
  approverName?: string
  error?: OfflineAdminError
}

// ─── Persistencia del snapshot ────────────────────────────────────────────────

export async function refreshAdminSnapshot(): Promise<boolean> {
  const instanceKey = getInstanceKey()
  const { branchId } = useConfigStore.getState()
  if (instanceKey === null || !branchId) return false

  const snapshot = await fetchKioskAdminSnapshot(branchId)
  if (!snapshot?.salt || !snapshot.iterations) return false

  return putCapped(ADMIN_SNAPSHOT_STORE, {
    ...snapshot,
    kind: SNAPSHOT_KIND,
    syncedAt: Date.now(),
    instanceKey
  } satisfies SnapshotRow)
}

// Devuelve el snapshot solo si sigue siendo válido para ESTA instancia y no
// venció. Un kiosco re-vinculado a otra caja/base cambia su instanceKey, así
// que el snapshot viejo deja de servirse sin necesidad de borrarlo (mismo
// criterio que offlineCache/orderQueue, design ADR-6).
export async function getAdminSnapshot(): Promise<SnapshotRow | null> {
  const instanceKey = getInstanceKey()
  if (instanceKey === null) return null

  const row = await getRecord<SnapshotRow>(ADMIN_SNAPSHOT_STORE, SNAPSHOT_KIND)
  if (!row || row.instanceKey !== instanceKey) return null
  if (Date.now() - row.syncedAt > row.ttlMs) return null

  return row
}

// ─── Validación offline ───────────────────────────────────────────────────────

export async function verifyAdminOffline(
  pin: string,
  operationRef: KioskOperationRef,
  auditMessage = ''
): Promise<OfflineAdminCheck> {
  const snapshot = await getAdminSnapshot()
  if (!snapshot) return { ok: false, error: 'snapshot_unavailable' }

  // Un solo hash para todos los admins: el salt es del snapshot, no de cada
  // admin, justamente para no pagar 50k iteraciones de SHA-256 en JS puro por
  // cada cajero de la sucursal en cada intento de PIN.
  const candidate = iteratedHash(pin, snapshot.salt, snapshot.iterations)
  const admin = snapshot.admins.find((a) => a.passwordHash === candidate)
  if (!admin) return { ok: false, error: 'admin_not_found' }

  // Se replica la regla de action_check_kiosk_admin: con niveles apagados
  // cualquier admin aprueba cualquier operación
  if (snapshot.usePermissionLevels && !admin.operations.includes(operationRef)) {
    return { ok: false, error: 'no_allowed' }
  }

  await enqueueOfflineAudit({
    localId: randomUUID(),
    operationRef,
    approverCashierId: admin.cashierId,
    approvedAt: new Date().toISOString(),
    sessionId: useSessionStore.getState().sessionId,
    message: auditMessage || 'Autoservicio (offline)'
  })

  return { ok: true, approverCashierId: admin.cashierId, approverName: admin.name }
}

// ─── Cola de auditoría offline ────────────────────────────────────────────────

async function enqueueOfflineAudit(entry: KioskAuditEntry): Promise<void> {
  const stored = await putCapped(AUDIT_QUEUE_STORE, entry)
  if (!stored) {
    // No se aborta la aprobación: el supervisor ya se identificó válidamente y
    // dejarlo afuera por una cuota de IndexedDB llena empeora las cosas. Pero
    // el rastro se pierde, así que tiene que quedar ruidoso en consola.
    console.error('[adminSnapshot] No se pudo encolar la auditoría offline; la aprobación queda sin rastro', entry)
  }
}

export async function getPendingAudit(): Promise<KioskAuditEntry[]> {
  return getAllRecords<KioskAuditEntry>(AUDIT_QUEUE_STORE)
}

// Registra en Odoo las aprobaciones resueltas offline y borra SOLO las que
// Odoo confirmó. Lo que no vuelve confirmado queda para el próximo intento.
export async function flushAuditQueue(): Promise<number> {
  const pending = await getPendingAudit()
  if (pending.length === 0) return 0

  const { loggedIds } = await logKioskAudit(pending)
  for (const localId of loggedIds ?? []) {
    await deleteRecord(AUDIT_QUEUE_STORE, localId)
  }

  return (loggedIds ?? []).length
}

// ─── Sincronización periódica ─────────────────────────────────────────────────

let refreshTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeConfig: (() => void) | null = null

async function syncNow(): Promise<void> {
  if (!useConfigStore.getState().isConnectionReady) return
  try {
    await refreshAdminSnapshot()
    await flushAuditQueue()
  } catch (err) {
    // Sin conexión el refresh falla y el snapshot previo se conserva hasta
    // vencer — que es exactamente para lo que existe
    console.error('[adminSnapshot] Error sincronizando el snapshot de admins:', err)
  }
}

// Dos disparadores, porque ninguno alcanza solo: el intervalo mantiene el
// snapshot fresco mientras hay conexión (si venciera estando online, el kiosco
// se quedaría sin validación offline al caerse la red), y la suscripción lo
// refresca en el instante de la reconexión sin esperar hasta 5 minutos.
export function startAdminSnapshotSync(): void {
  if (refreshTimer !== null) return

  unsubscribeConfig = useConfigStore.subscribe((state, prevState) => {
    if (!prevState.isConnectionReady && state.isConnectionReady) {
      void syncNow()
    }
  })

  refreshTimer = setInterval(() => {
    void syncNow()
  }, REFRESH_INTERVAL_MS)

  void syncNow()
}

export function stopAdminSnapshotSync(): void {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  unsubscribeConfig?.()
  unsubscribeConfig = null
}
