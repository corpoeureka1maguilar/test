# Exploration: Gift Card Integration in Autopay Kiosk

## Objective
Explore backend models and POS frontend references to integrate Gift Card purchase and payment into the Autopay kiosk.

## Backend Architecture (Odoo 19 `eu_pos_gift_card`)
- `x.pos.gift.card`: Handles state (`new`, `available`, `consumed`), amount, code and payment consumption.
- `action_assign_card_from_sale`: Receives `{ amount, partner_id, code }`, creates a card in state `new`.
- `action_search_gift_card`: Looks up card status and balance by code.
- `action_pay`: Conciliates the card against an invoice.
- `sale.order` interceptor: Resolves new card purchase if `giftCard` with `state == 'new'` is in the payload.

## Frontend references (`eu_fex_ppal`)
- Identifies Gift Card orders if the catalog cart contains the configured gift card product.
- Generates 14-char code with prefix `CARD` + SHA-1 token of timestamp.
- Calls `action_assign_card_from_sale` before submitting order when purchasing.
- Uses `searchGiftCard(code)` to fetch balance when paying, imputes consumption amount on `order.giftCard`.
