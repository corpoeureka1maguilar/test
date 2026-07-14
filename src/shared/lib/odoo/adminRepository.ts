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
