# Tasks: Gift Card Integration

- [x] Create core types & models (`types.ts`).
- [x] Map product `isGiftCard` by ID checking (`odooRepository.ts`).
- [x] Create RPC helpers `searchGiftCard` and `assignCardFromSale` (`odooRepository.ts`).
- [x] Load and persist station configuration parameters (`config.ts`).
- [x] Implement síncrona `generateGiftCardCode()` helper (`cryptoUtils.ts`).
- [x] Prevent mixing items and implement `addGiftCard()` action (`cart.ts`).
- [x] Configure payment payload construction for new card and card payments (`saleOrderPayload.ts`).
- [x] Map printer payment method code to `'15'` for Gift Card (`printPayload.ts`).
- [x] Render numeric keypad modal for card amount in catalog (`ProductCatalog.tsx`, `ProductCatalog.module.css`).
- [x] Inject Gift Card payment option in payment selection (`PaymentSelect.tsx`).
- [x] Implement balance lookup and checkout confirmation page (`PaymentForm.tsx`, `PaymentForm.module.css`).
- [ ] Write Vitest unit tests for the Gift Card workflows.
- [ ] Run verification suite.
