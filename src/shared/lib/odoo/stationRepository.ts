import { odooEnv } from '@/shared/lib/odooEnv'

// ─── Station & Sessions ───────────────────────────────────────────────────────

export interface KioskStation {
  id: number
  name: string
  code: string
}

export interface LinkedStation {
  id: number
  name: string
  code: string
  branchId: number
  companyId: number
  activeSessionId: number | false
  operateWithoutPrinter: boolean
  allowLocalDB: boolean
}

export async function fetchStations(): Promise<KioskStation[]> {
  return odooEnv.callMethod<KioskStation[]>(
    'x.pos.station',
    'search_read',
    [[]],
    { fields: ['id', 'name', 'code'] }
  )
}

export async function linkStation(configToken: string, appToken: string): Promise<LinkedStation> {
  const raw = await odooEnv.callMethod<Record<string, unknown>>(
    'x.pos.station',
    'action_set_config',
    [configToken, appToken]
  )
  return {
    id: raw['id'] as number,
    name: raw['name'] as string,
    code: raw['code'] as string,
    branchId: raw['branchId'] as number,
    companyId: raw['companyId'] as number,
    activeSessionId: raw['activeSessionId'] as number | false,
    operateWithoutPrinter: raw['operateWithoutPrinter'] as boolean,
    allowLocalDB: raw['allowLocalDB'] as boolean,
  }
}

export async function pingStation(stationId: number): Promise<LinkedStation> {
  const raw = await odooEnv.callMethod<Record<string, unknown>>(
    'x.pos.station',
    'action_update_config',
    [[stationId]]
  )
  return {
    id: raw['id'] as number,
    name: raw['name'] as string,
    code: raw['code'] as string,
    branchId: raw['branchId'] as number,
    companyId: raw['companyId'] as number,
    activeSessionId: raw['activeSessionId'] as number | false,
    operateWithoutPrinter: raw['operateWithoutPrinter'] as boolean,
    allowLocalDB: raw['allowLocalDB'] as boolean,
  }
}

export async function fetchActiveSession(stationId: number): Promise<{ id: number; openingDate: string } | null> {
  const sessions = await odooEnv.callMethod<{ id: number; opening_date: string }[]>(
    'x.pos.session',
    'search_read',
    [[['station_id', '=', stationId], ['state', '=', 'active']]],
    { fields: ['id', 'opening_date'], limit: 1 }
  )
  if (sessions && sessions.length > 0) {
    return { id: sessions[0].id, openingDate: sessions[0].opening_date }
  }
  return null
}

export async function openOdooSession(stationId: number, cashierId: number): Promise<number> {
  const sessionId = await odooEnv.callMethod<number>(
    'x.pos.session',
    'action_create_from_pos',
    [
      {
        cashier: cashierId,
        openingDate: new Date().toISOString(),
        station: stationId,
        version: '1.0.0'
      }
    ]
  )

  if (!sessionId) throw new Error('No se pudo aperturar la sesión en Odoo')

  // Establecer cajero activo
  await odooEnv.callMethod<boolean>(
    'x.pos.session',
    'action_set_active_cashier',
    [sessionId, cashierId, '1.0.0']
  )

  return sessionId
}

export async function closeOdooSession(sessionId: number): Promise<void> {
  await odooEnv.callMethod<boolean>(
    'x.pos.session',
    'action_close_session',
    [sessionId]
  )
}

export async function fetchCashier(uid: number, stationId: number): Promise<{ id: number; name: string } | null> {
  const result = await odooEnv.callMethod<{ cashierId: number | false; name: string } | false>(
    'x.pos.cashier',
    'action_get_cashier_by_user',
    [uid, stationId]
  )
  return result && result.cashierId ? { id: result.cashierId, name: result.name } : null
}
