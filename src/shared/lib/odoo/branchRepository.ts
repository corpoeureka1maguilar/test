import { odooEnv } from '@/shared/lib/odooEnv'
import { useConfigStore } from '@/shared/stores/config'
import type { AdConfig } from '@/shared/types/types'

export async function fetchCompanyLogo(): Promise<string> {
  const results = await odooEnv.callMethod<{ x_fex_image: string | false }[]>(
    'res.branch', 'search_read',
    [[]],
    { fields: ['x_fex_image'], limit: 1 }
  )
  return results?.[0]?.x_fex_image || ''
}

export async function fetchAdvertisements(): Promise<AdConfig[]> {
  try {
    const stationId = useConfigStore.getState().stationId
    const config = await odooEnv.callMethod<{ ad_configs?: AdConfig[] }>(
      'x.pos.station',
      'action_get_custom_config',
      stationId ? [stationId] : []
    )
    return config?.ad_configs || []
  } catch (err) {
    console.error('Error fetching ads from backend:', err)
    return []
  }
}

export async function fetchBranchState(): Promise<string> {
  // const [branch] = await odooEnv.callMethod<{ id: number; state_id: [number, string] | false }[]>(
  //   'res.branch', 'read', [[branchId]],
  //   { fields: ['id', 'state_id'] }
  // )
  // return branch?.state_id ? branch.state_id[1] : ''
  return ''
}

export async function fetchBranchFixedProducts(branchId: number): Promise<number[]> {
  const [branch] = await odooEnv.callMethod<{ id: number; x_autopay_fixed_product_ids: number[] | false }[]>(
    'res.branch', 'read', [[branchId]],
    { fields: ['id', 'x_autopay_fixed_product_ids'] }
  )
  return branch?.x_autopay_fixed_product_ids || []
}

export async function fetchBranchDefaultPricelist(branchId: number): Promise<number> {
  const [branch] = await odooEnv.callMethod<{ id: number; x_fex_default_pricelist_id: [number, string] | false }[]>(
    'res.branch', 'read', [[branchId]],
    { fields: ['id', 'x_fex_default_pricelist_id'] }
  )
  return branch?.x_fex_default_pricelist_id ? branch.x_fex_default_pricelist_id[0] : 0
}

export interface OdooState {
  id: number
  name: string
  code: string
}

interface RawState {
  id: number
  name: string
  code: string
}

export async function fetchStates(): Promise<OdooState[]> {
  const raw = await odooEnv.callMethod<RawState[]>(
    'res.country.state', 'search_read',
    [[['country_id.code', '=', 'VE']]],
    { fields: ['id', 'name', 'code'] }
  )
  return raw.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code
  }))
}
