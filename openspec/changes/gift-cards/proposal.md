# Proposal: Gift Cards in Autopay Kiosk

## Background
The customer wants the kiosk of Autopay (`eu_fex_autopay`) to support:
1. Purchasing a physical/printed Gift Card at the kiosk.
2. Paying for normal orders using an existing Gift Card.

## Scope
- Retrieve gift card configurations from Odoo (active status, gift card product ID).
- Block mixing regular catalog products with Gift Card purchase.
- Prompt for loading amount when buying a Gift Card.
- Generate a unique code and assign the card prior to order completion.
- Render "Tarjeta de regalo" as a payment option.
- Allow checking card balance, verifying active status, and completing order with zero normal payments by writing the card to `giftCard` payload attribute.
