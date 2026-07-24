# Design: Gift Card + N Cobros VPOS Sucesivos

## Technical Approach

Generalizar el patrón 2-leg ya shippeado a **una gift card opcional + N piernas VPOS acumuladas cliente-side**, enviadas a Odoo en UN solo `sale.order` al cerrar (el backend itera `payments[]` genéricamente; el `x_fex_id` deduplica por orden). La gift card sigue siendo un singleton (`giftCardLeg`) que alimenta `payload.giftCard`; las piernas VPOS pasan a un array `legs[]` que alimenta `payload.payments[]`. El total se somete recién cuando `remainingAmount === 0`; hasta entonces cada cobro exitoso hace loop-back a `selectingMethod`.

## Architecture Decisions

### Decision: `legs: PaymentLeg[]` para VPOS + `giftCardLeg` singular (NO fold-in)
**Choice**: `legs[]` acumula solo piernas VPOS; la gift card queda como campo singular `giftCardLeg` (una por venta).
**Alternatives**: (a) unión discriminada con la gift card dentro de `legs[]`; (b) mantener todo singular.
**Rationale**: La gift card es estructuralmente distinta (una por venta — req negocio; va a `payload.giftCard` no `payments[]`; consume balance en USD; tender `'15'`). Mantenerla separada preserva el caso shippeado **byte-idéntico** (path de gift card sin tocar) y cumple el cap de una-tarjeta sin guardas extra. `legs[]` describe exactamente el shape pedido (method+amount+igtf+ref).

### Decision: evento `VPOS_LEG_PAID` guardado (no reusar `GIFT_CARD_PARTIAL`)
**Choice**: nuevo evento `VPOS_LEG_PAID { payment, method, baseBs }`; transición con guard `coversRemaining` decide `processing` (cierra) vs `selectingMethod` (loop). `GIFT_CARD_PARTIAL` queda intacto (siempre loopea, nunca cierra).
**Alternatives**: reusar `GIFT_CARD_PARTIAL` generalizado.
**Rationale**: la gift card SIEMPRE deja remanente (loop incondicional, sin guard); una pierna VPOS puede cerrar o loopear — semánticas distintas. Un evento propio con guard es más legible que forzar bifurcación en el evento de gift card.

### Decision: monto de pierna VPOS = monto confirmado (default = remanente)
**Choice**: `baseBs` de la pierna es autoritativo desde el monto confirmado antes de lanzar el terminal (default = `remainingAmount`, tope = remanente). El commit ocurre SOLO al recibir `codRespuesta === '00'`.
**Rationale**: habilita el split deliberado ($30 + $20). Si el terminal reporta monto aprobado parcial, se reconcilia contra `baseBs` (ver Risks — protocolo del mock no verificable acá).

### Decision: submit a Odoo UNA vez al cerrar
**Choice**: `processing`/`enqueuingOffline`/`printing` consumen `legs[]` completo cuando `remainingAmount === 0`.
**Rationale**: el backend espera todos los pagos en una orden; dedup por orden. Submit per-leg rompería el modelo y multiplicaría el riesgo de duplicados.

## Data Flow

    GiftCardView (opcional, balance<total)
      │ GIFT_CARD_PARTIAL {giftCard, remainingAmount}   (loop incondicional)
      ▼
    selectingMethod ◄─────────────────────────────┐
      │ SELECT_METHOD (mismo método VPOS permitido)│
      ▼                                            │ [remaining>0]
    enteringDetails / VposPaymentView              │
      │ terminal codRespuesta '00'                 │
      │ VPOS_LEG_PAID {payment, method, baseBs}    │
      ├── guard coversRemaining? ──NO──► commitLeg ┘  (push legs[], remaining-=baseBs)
      │                          SÍ
      ▼ commitLeg (remaining→0)
    processing ─► buildSaleOrderPayload(cart, legs[], giftCardLeg)
      │             payments = legs.map(...)  + giftCard singular
      ▼
    printing ─► buildFacturaPayload(tenders[])  (acumula por printerCode)
      ▼
    success   (offline: enqueuingOffline replay verbatim, legs[] incluidos)

**Retry safety (req 3)**: `commitLeg` corre SOLO como acción de `VPOS_LEG_PAID`, que solo se dispara con `'00'`. Timeout/rechazo del terminal → NO se dispara → `legs[]` y `remainingAmount` intactos; el cajero reintenta desde `selectingMethod`. No hace falta estado `retryLeg` (la pierna nunca se commiteó).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `types.ts` | Modify | `printerCode?: string` en `KioskPaymentMethod`; nueva interface `PaymentLeg { method; amountBs; baseBs; montoIgtf; reference; ts }` |
| `machines/saleMachine.ts` | Modify | Context: `legs: PaymentLeg[]` reemplaza acumulación implícita; conservar `giftCardLeg`/`remainingAmount`. Evento `VPOS_LEG_PAID`; acción `commitLeg` (push + recalcular remaining); guard `coversRemaining`; `enteringDetails.on.VPOS_LEG_PAID` bifurca processing/selectingMethod; `processing`/`enqueuingOffline`/`printing` toman `legs[]`+`giftCardLeg`; reset incluye `legs:[]` |
| `hooks/useVposCheckout.ts` | Modify | En `'00'`: dispara `VPOS_LEG_PAID` (no `SUBMIT_PAYMENT`); navega `/resultado` si cierra, `/pago` si loop (mismo helper `coversRemaining`) |
| `pages/PaymentForm.tsx` | Modify | `effectiveTotal` ya usa `remainingAmount`; pasar `baseBs`/tope a la pierna VPOS |
| `pages/PaymentSelect.tsx` | Modify | Permitir re-elegir mismo método VPOS; bloquear gift card si `giftCardLeg`; filtrar/deshabilitar métodos con `printerCode` vacío + mensaje; aplicar cap `MAX_PAYMENT_LEGS`; render de piernas + remanente |
| `shared/lib/odoo/paymentMethodRepository.ts` | Modify | `printer_code` en `search_read`, `RawMethod`, `mapMethod` (`printerCode: r.printer_code ?? ''`) |
| `shared/lib/saleOrderPayload.ts` | Modify | Firma `(customer, cart, legs, attemptId, giftCard)`; `payments = legs.map(l => ({..., amount:l.amountBs, journal:l.method.journalId, method:l.method.id, montoIgtf:l.montoIgtf}))`; eliminar forzado `montoIgtf:0`; IGTF real per-leg (`calcIgtf`) |
| `shared/lib/printPayload.ts` | Modify | `buildFacturaPayload(tenders[])`: acumular numérico por código `map[code]=(map[code]??0)+amountBs`, formatear al final con `fixNumberForAPI`; `montoigtf` = suma de igtf de piernas; gift card = tender `{code:'15'}`; assert defensivo si `printerCode` vacío (nunca default `'01'`) |
| `shared/lib/paymentConfig.ts` | Create | `export const MAX_PAYMENT_LEGS = 4` (incluye gift card) |

## Interfaces / Contracts

```ts
interface PaymentLeg {
  method: KioskPaymentMethod  // trae printerCode, journalId, currencyId, igtf
  amountBs: number            // base + IGTF de la pierna → payments[].amount
  baseBs: number              // base sin IGTF → decrementa remainingAmount
  montoIgtf: number           // calcIgtf(method, baseBs)
  reference: string           // numeroReferencia | numSeq del terminal
  ts: number
}
// buildFacturaPayload: Tender[] = { code: string; amountBs: number; igtfBs: number }[]
// acumula por code; en producción (applyIgtf=false) igtfBs=0 → byte-idéntico
```

**Cap (req 5)**: `MAX_PAYMENT_LEGS = 4` (gift card cuenta 1), constante en `paymentConfig.ts`. Aplicado en `PaymentSelect`: `tenderCount = (giftCardLeg?1:0)+legs.length`; si `>= MAX`, deshabilitar cards + mensaje "Máximo 4 medios de pago". La pierna que alcanza el tope se fuerza a monto = remanente completo (sin split parcial).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Machine | `VPOS_LEG_PAID` con remanente>0 → `selectingMethod` persiste `legs[]`; con remanente=0 → `processing`; `saleAttemptId` estable en el loop | `createActor` |
| Machine | fallo/timeout tras N piernas NO altera `legs[]`/`remainingAmount` | `createActor` |
| Unit | `buildSaleOrderPayload`: `payments.length === legs.length`, suma == total, IGTF real per-leg; full gift card → `payments:[]` | Vitest |
| Unit | `buildFacturaPayload`: dos piernas mismo `printerCode` → acumula (no sobreescribe); suma tenders == total; código vacío → throw | Vitest |
| Regresión | gift card + 1 VPOS (applyIgtf=false) byte-idéntico; venta un método idéntica | Vitest |

## Migration / Rollout

Sin migración ni cambio backend. Feature-flag recomendado para el loop N-VPOS (proposal): el fix de `printer_code`/acumulación puede quedar activo aunque el split multi-VPOS se apague. Rollback = revert del PR. **GATE fiscal**: `printerCode` real vs `'01'` hardcodeado afecta TODA venta — validar en impresora real antes de producción.

## Open Questions

- [ ] **Protocolo del terminal VPOS**: si la respuesta reporta monto aprobado (para reconciliar aprobación parcial vs `baseBs`) no es verificable desde este repo — asumir monto solicitado == aprobado salvo evidencia. Impacta solo el split por aprobación-parcial, no el split deliberado por cajero.
- [ ] **`MAX_PAYMENT_LEGS` runtime-config**: v1 constante (4); mover a config store si operaciones lo pide (state model soporta N sin cambios).
- [ ] **Riesgo residual**: dinero capturado en terminales de piernas 1..n y luego `OdooServerError` permanente en el submit final. Mismo riesgo que hoy con 1 pierna; mitigado por cola offline para errores deferrables. Documentado, no nuevo.
