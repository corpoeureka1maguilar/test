# Design: Gift Cards

## Architecture Decisions

### ADR-1: Product Identification Bypassing Custom Field
- **Problem**: Querying `is_gift_card` on `product.product` causes `ValueError` in Odoo databases where registry inheritance has not loaded/updated the field properly.
- **Solution**: Derive `isGiftCard` in the mapping layer (`mapProduct`) by matching product IDs against `giftCardProductId` loaded from Odoo settings. Remove the field from the Odoo query fields list.

### ADR-2: Code Generation Safety
- **Problem**: Relying on asynchronous `crypto.subtle` or `crypto.randomUUID` in HTTP/non-secure LAN environments causes runtime errors.
- **Solution**: Use `sha256Hex` implementation based on pure JS and `Math.random` to generate unique 14-character codes prefixed with `"CARD"`.

### ADR-3: Single Payment Constraint
- **Problem**: Kiosk checkout does not support splitting payments across multiple payment journals.
- **Solution**: Restrict Gift Card payments to cards that can cover the full total of the order. If the balance is insufficient, prevent confirmation and guide the customer.
