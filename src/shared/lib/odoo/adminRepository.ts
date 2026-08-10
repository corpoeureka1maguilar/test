import { odooEnv } from '@/shared/lib/odooEnv'

// ─── Validación de administrador del kiosco ───────────────────────────────────

// xml ids de x.pos.audit.operation: las tres primeras son propias del
// autoservicio (data de eu_autopay_bridge); las demás se comparten con el POS
// para que el permiso se configure una sola vez por cajero
export const KIOSK_OPERATIONS = {
  advancedAccess: 'eu_autopay_bridge.x_pos_audit_autoservicio_advanced_access',
  openSession: 'eu_autopay_bridge.x_pos_audit_autoservicio_open_session',
  terminalConfig: 'eu_autopay_bridge.x_pos_audit_autoservicio_terminal_config',
  continueWithoutInvoice: 'eu_autopay_bridge.x_pos_audit_autoservicio_continue_without_invoice',
  saleReturn: 'eu_pos_permission_levels.x_pos_audit_sale_return',
  invoiceReprint: 'eu_pos_permission_levels.x_pos_audit_invoice_reprint',
  shiftClose: 'eu_pos_permission_levels.x_pos_audit_midday_close',
  sessionClose: 'eu_pos_permission_levels.x_pos_audit_session_close'
} as const

export type KioskOperationRef = (typeof KIOSK_OPERATIONS)[keyof typeof KIOSK_OPERATIONS]

export interface KioskAdminCheck {
  ok: boolean
  approverCashierId?: number
  approverName?: string
  error?: 'operation_not_found' | 'admin_not_found' | 'no_allowed'
}

export async function checkKioskAdmin(
  password: string,
  operationRef: KioskOperationRef,
  branchId: number,
  sessionId: number | null = null,
  message = ''
): Promise<KioskAdminCheck> {
  return odooEnv.callMethod<KioskAdminCheck>(
    'x.pos.cashier', 'action_check_kiosk_admin',
    [password, operationRef, branchId, sessionId, message]
  )
}

// ─── Snapshot de admins para validación offline ───────────────────────────────

// El kiosco no tiene PIN propio: la fuente de verdad es `admin_password` del
// cajero. Sin conexión no hay a quién preguntarle, así que se cachea este
// snapshot (ver adminSnapshot.ts). `passwordHash` viene hasheado con `salt` e
// `iterations` — el password en claro nunca sale de Odoo.
export interface KioskAdminEntry {
  cashierId: number
  name: string
  passwordHash: string
  operations: string[]
}

export interface KioskAdminSnapshot {
  salt: string
  iterations: number
  ttlMs: number
  usePermissionLevels: boolean
  admins: KioskAdminEntry[]
}

export async function fetchKioskAdminSnapshot(branchId: number): Promise<KioskAdminSnapshot> {
  return odooEnv.callMethod<KioskAdminSnapshot>(
    'x.pos.cashier', 'action_export_kiosk_admins', [branchId]
  )
}

// Aprobaciones que se validaron contra el snapshot local: Odoo no las vio
// pasar, así que hay que registrarlas al reconectar o quedan sin auditoría.
export interface KioskAuditEntry {
  localId: string
  operationRef: KioskOperationRef
  approverCashierId: number
  approvedAt: string
  sessionId: number | null
  message: string
}

export async function logKioskAudit(entries: KioskAuditEntry[]): Promise<{ loggedIds: string[] }> {
  return odooEnv.callMethod<{ loggedIds: string[] }>(
    'x.pos.cashier', 'action_log_kiosk_audit', [entries]
  )
}
