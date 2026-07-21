# Design: VPOS Merchant Payment

## Technical Approach
Treat the VPOS terminal as an out-of-process web surface: the kiosk embeds the terminal's checkout page in an `<iframe>` and communicates the result back via `window.postMessage`, so the real integration only needs to serve a page at a known URL and post a JSON result shaped like the existing mock/contract-test response. A local Node mock (`merchant-mock.js`) implements that contract for development.

## Architecture Decisions

### Decision: iframe + postMessage instead of a direct fetch from the kiosk
- **Choice**: Kiosk embeds `GET {base}/vpos/checkout?amount&cedula` in an iframe; that page collects card details and calls its own backend, then `postMessage`s the result to `window.parent`.
- **Alternatives Considered**: Kiosk calls the terminal's API directly via `fetch`.
- **Rationale**: Card PIN/clave entry must not pass through kiosk application code (PCI-adjacent concern) and terminal vendors typically expose a hosted checkout page precisely for this reason. Keeping the contract as "iframe + postMessage" means swapping the mock for a real vendor URL requires no kiosk code changes beyond the base URL.

### Decision: Ping before waiting, timeout while waiting
- **Choice**: `GET {base}/vpos/ping` first; only start the 60s response timeout and render the iframe after a 2xx.
- **Alternatives Considered**: Skip the ping and rely solely on the timeout.
- **Rationale**: A dead terminal shouldn't force the cashier to wait 60s to find out — the ping fails fast. The timeout still guards against a terminal that's reachable but hangs mid-transaction.

### Decision: Mock's checkout page proxies to the mock's own `POST /vpos/metodo`
- **Choice**: The checkout HTML's "Aceptar" button `fetch`es `/vpos/metodo` (same server) instead of building the response in the browser.
- **Alternatives Considered**: Generate the fake approval response directly in client-side JS.
- **Rationale**: Single source of truth for the mock response shape — `POST /vpos/metodo` is also the contract exercised by `cardTerminal.contract.test.ts`. Avoids drift between two mock response generators.

## Data Flow
```
PaymentForm (withMerchant)
  → GET {base}/vpos/ping
      ok  → render iframe src={base}/vpos/checkout?amount&cedula ; start 60s timeout
      fail → toast error, send(BACK), navigate(/pago)

iframe (checkout.html)
  → cashier fills tipoTarjeta + clave, clicks Aceptar
  → POST {base}/vpos/metodo { accion, cedula, montoTransaccion, tipoTarjeta, clave }
  → window.parent.postMessage(JSON.stringify(response), '*')

PaymentForm window 'message' listener
  → codRespuesta === '00' → clearTimeout, send(SUBMIT_PAYMENT), navigate(/resultado)
  → otherwise             → clearTimeout, toast error (stays on screen)
  → (no message within 60s) → toast error, send(BACK), navigate(/pago)
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/shared/lib/odooRepository.ts` | Modify | `RawMethod.with_merchant`, `mapMethod` → `withMerchant`, added to `search_read` fields |
| `src/shared/types/types.ts` | Modify | `KioskPaymentMethod.withMerchant?: boolean` |
| `src/features/payment/pages/PaymentForm.tsx` | Modify | `vposStatus` state, ping+timeout `useEffect`, `withMerchant` render branch with spinner/iframe |
| `merchant-mock.js` | Modify | `renderCheckoutHtml`, `GET /vpos/checkout` route, `tipoTarjeta` passthrough in `POST /vpos/metodo` |

## Interfaces / Contracts
```typescript
// window 'message' payload from the terminal checkout page (JSON-encoded string)
interface VposMessage {
  codRespuesta: string        // '00' = aprobado
  mensajeRespuesta?: string
  numeroReferencia?: string
  numSeq?: number
}
```
Consistent with `VposResponse` in `src/features/payment/contracts/cardTerminal.contract.test.ts`.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `fetchPaymentMethods` maps `with_merchant` → `withMerchant` | `odooRepository.test.ts` (existing, extended) |
| Contract | VPOS HTTP shape (`ping`, `metodo`, `metodo_cashea`) | `cardTerminal.contract.test.ts` (existing, unchanged by this work) |
| Manual | Ping failure, timeout, approve, reject flows | Run `npm run mock:merchant` (or `node merchant-mock.js`) + kiosk dev server |

## Migration / Rollout
None — additive; methods without `with_merchant` are unaffected.

## Open Questions
- Real terminal base URL and auth mechanism (pending vendor integration — out of scope here).
