import { odooEnv } from '@/shared/lib/odooEnv'
import type { GiftCard } from '@/shared/types/types'

// ─── Gift Cards ──────────────────────────────────────────────────────────────

export async function searchGiftCard(code: string): Promise<GiftCard | null> {
  const result = await odooEnv.callMethod<GiftCard | null>(
    'x.pos.gift.card',
    'action_search_gift_card',
    [code]
  )
  return result
}

export interface AssignCardFromSaleInput {
  amount: number
  partner_id: number
  code: string
}

export async function assignCardFromSale(data: AssignCardFromSaleInput): Promise<GiftCard> {
  return odooEnv.callMethod<GiftCard>(
    'x.pos.gift.card',
    'action_assign_card_from_sale',
    [data]
  )
}
