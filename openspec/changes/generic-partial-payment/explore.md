# Exploration: `generic-partial-payment` — habilitar pago parcial entre cualquier par de métodos de pago

## Current State (recap del trabajo previo + confirmado en esta sesión)

**Ya implementado** (`gift-card-partial-payment`, commits `dde4a88`, `6449949`): exactamente 2 piernas — gift card parcial + un segundo método cualquiera. Estado en `saleMachine.ts` es **singular** (`context.giftCardLeg: GiftCard | null`, `context.remainingAmount: number | null`), no un array. `saleOrderPayload.ts` tiene una rama `isPartialRemainder` que fuerza `montoIgtf: 0` en el remainder. `printPayload.ts` tiene un ternario hardcodeado `method.id === -999 ? '15' : '01'` para decidir el código de tender fiscal.

**Backend** (`eu_agroo_fex_integration_v19/eu_pos_base/models/sale_order.py::_action_create_payments_from_pos`, líneas 865-902): itera `data` (payments[]) genéricamente con un loop `for payment in data`, sin asumir cantidad de piernas — confirmado, no es cuello de botella.

## Hallazgo nuevo verificado en esta sesión (`x_pos_payment_method.py`)

Archivo: `eu_agroo_fex_integration_v19/eu_pos_base/models/x_pos_payment_method.py`

- Línea 37: `printer_code = fields.Char("Código en la impresora fiscal", tracking=True)` — **sin `required=True`, sin `default`**.
- Línea 107: `_action_get_payment_methods_query` hace `COALESCE(pm.printer_code, '') as printer_code` — el propio backend anticipa que puede venir NULL y lo neutraliza a string vacío en vez de fallar.
- **Vista de formulario** (`x_pos_payment_method_views.xml:25`): `<field name="printer_code" />` — sin `required="1"`, a diferencia de `name`, `currency_id`, `journal_id`, `payment_type` que sí lo tienen. Prueba a nivel de UI: operaciones puede guardar un método sin código de impresora, nada se lo impide.
- **No existe `_sql_constraints`** en el modelo y no hay ningún `@api.constrains` sobre `printer_code` (solo existe uno sobre `with_merchant`/`merchant_card_types`, demostrando que el patrón existe en el codebase pero no se aplicó acá). Nada impide que dos métodos activos compartan el mismo `printer_code`.
- Frontend (`paymentMethodRepository.ts:47-51`) no pide `printer_code` en el `search_read`, y `KioskPaymentMethod` (`types.ts:55-68`) no tiene ese campo — el dato existe en Odoo pero nadie lo trae al kiosco.

### Descubrimiento adicional: el bug de tender code no es exclusivo del pago parcial

`buildFacturaPayload` (`printPayload.ts:171`) usa el mismo ternario `method.id === -999 ? '15' : '01'` **para TODA venta con un solo método**, no solo para el remainder de un pago parcial. Hoy, una venta de un solo pago con `transferencia`, `pago_movil`, `card`, `banplus`, etc. — todas reportan `'01'` a la impresora fiscal por igual, sin distinción real de método. Este gap de precisión fiscal **ya existe en producción independientemente de este change**.

## Affected Areas

- `eu_fex_autopay/src/shared/lib/odoo/paymentMethodRepository.ts` — agregar `printer_code` al `search_read` y al mapeo (`RawMethod`, `mapMethod`)
- `eu_fex_autopay/src/shared/types/types.ts` — agregar `printerCode?: string` a `KioskPaymentMethod`
- `eu_fex_autopay/src/shared/lib/printPayload.ts` — reemplazar el ternario hardcodeado por `method.printerCode`; blindar `payload[methodCode] = ...` para acumular en vez de sobreescribir; decidir política para `printerCode` vacío
- `eu_fex_autopay/src/features/payment/machines/saleMachine.ts` — `giftCardLeg`/`remainingAmount` singulares deben generalizarse (mantenido a 2 piernas exactas, ver alcance)
- `eu_fex_autopay/src/shared/lib/saleOrderPayload.ts` — la rama `isPartialRemainder` (fuerza `montoIgtf: 0`) generalizada a "leg1 cualquier método + leg2 cualquier método"
- `eu_fex_autopay/src/features/payment/pages/PaymentSelect.tsx` — el gate `showGiftCardOption` es específico de gift card; falta el análogo genérico (no repetir la pierna ya elegida, filtrar métodos sin `printerCode`)
- `eu_agroo_fex_integration_v19/eu_pos_base/models/x_pos_payment_method.py` — candidato a un `@api.constrains` de `printer_code` obligatorio cuando `use_for_payment=True` (fuera del alcance del frontend, recomendable como fix de datos en el backend)

## Preguntas puntuales respondidas

**1. ¿Todos los métodos activos tienen `printer_code` no vacío?**
No se puede confirmar sin consulta directa a la base real. El código deja claro que es estructuralmente posible que venga vacío: campo opcional, sin default, sin `required` en la vista, y el propio backend hace `COALESCE(..., '')` anticipando el caso. Recomendación: audit de datos (`SELECT id, name, payment_type, printer_code FROM x_pos_payment_method WHERE active AND use_for_payment AND caja_autoservicio`) como tarea previa a implementar. En el frontend: NO rellenar con un fallback silencioso (repetiría el bug actual). Tratar `printerCode` vacío como error de configuración: bloquear ese método para pago parcial con mensaje claro, no adivinar un código.

**2. ¿Pueden dos métodos activos compartir el mismo `printer_code` por error?**
Sí — confirmado, no hay constraint de unicidad. El bug de `payload[methodCode] = amount` sobreescribiendo en vez de acumular se dispara igual aunque el dato ya no sea "desconocido". Hay que blindarlo (acumular por código) independientemente de la decisión de alcance — fix P0.

**3. ¿Cambia la recomendación de alcance?**
Mejora, pero no elimina los dos bloqueos más caros ya identificados. Resuelve el bloqueo de hardware/protocolo (códigos de tender ya no son incógnita). No cambia: el rediseño del state model (singular → 2 piernas genéricas) sigue siendo el mismo esfuerzo; la política de IGTF por pierna sigue siendo una decisión de negocio/compliance abierta.

## Approaches

1. **Big-bang: cualquier método + cualquier método, N piernas, de una vez** — Pros: resuelve el pedido completo en un change. Cons: mezcla refactor mecánico con decisión de compliance no resuelta (IGTF per-leg); alto radio de blast fiscal. Effort: High.

2. **Fase 1 (quick win) + Fase 2 (2 piernas genéricas) + Fase 3 (N piernas, gated) — RECOMENDADO**
   - Fase 1: traer `printer_code`, usarlo en `printPayload.ts`, blindar la acumulación por código. Beneficia TODAS las ventas hoy, bajo riesgo, sin tocar el state model.
   - Fase 2: generalizar a "leg1 método cualquiera + leg2 método cualquiera" manteniendo el límite de exactamente 2 piernas. Responde al pedido del usuario sin abrir N>2.
   - Fase 3 (change separado, bloqueado por decisión de negocio): N>2 piernas y/o IGTF calculado per-leg — requiere sign-off de finanzas/compliance antes de tocar código.
   - Pros: entrega valor rápido, aísla la decisión de compliance no resuelta. Cons: 3 changes en vez de 1. Effort: Medium (Fase 1+2), gated (Fase 3).

3. **No generalizar, mantener gift-card-only** — descartado; el hallazgo de `printer_code` reduce el costo real de generalizar.

## Recommendation

Approach 2. Fase 1 es casi gratis y corrige un bug fiscal latente que existe HOY independientemente de este change. Fase 2 responde al pedido tal cual fue planteado sin heredar la ambigüedad de compliance de N>2 piernas. Fase 3 debe quedar explícitamente fuera de este change hasta que exista una decisión de negocio sobre IGTF per-leg.

## Risks

- `printer_code` puede venir vacío para métodos activos hoy en producción — necesita audit de datos antes de implementar y una política explícita de bloqueo, no un fallback silencioso.
- Dos métodos activos pueden compartir `printer_code` por error de configuración — el bug de sobreescritura en `printPayload.ts` debe blindarse independientemente del alcance elegido.
- IGTF per-leg sigue siendo una decisión de compliance no resuelta — requiere sign-off explícito antes de Fase 3.
- El fix de Fase 1 (usar `printerCode` real en vez de `'01'` hardcodeado) es un cambio de comportamiento fiscal para ventas ya existentes — debe validarse con el equipo que opera la impresora fiscal antes de producción, no asumir que es un no-op.
- No hay acceso a un shell/consulta directa a la base de Odoo en este entorno — la confirmación empírica de "qué métodos tienen `printer_code` poblado hoy" queda pendiente como tarea de implementación.

## Ready for Proposal

Sí, para Fase 1 y Fase 2 — alcance acotado a "2 piernas, cualquier método, `printerCode` real". Fase 3 (N piernas, IGTF per-leg) NO está lista: necesita decisión de negocio primero.
