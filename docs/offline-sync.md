# Offline-First Synchronizer — Notas de Operación

Este documento acompaña los módulos nuevos bajo `src/shared/lib/` (`idbStore`,
`offlineCache`, `orderQueue`, `syncManager`) y `src/shared/hooks/useShouldBlockUI.ts`.
Ver `openspec/changes/offline-sync/design.md` para el diseño completo (ADRs).

## Política de stock offline (drift aceptado)

**No existe hoy ningún chequeo de stock en tiempo real en el flujo de venta del
kiosko** (ni online ni offline) — `fetchProducts` no trae cantidades disponibles
y `action_create_sale_order_from_pos` no valida stock antes de confirmar.

Esto significa que, cuando el kiosko vende offline y encola hasta 5 órdenes en
`orderQueue`, esas ventas se confirman contra el catálogo cacheado (precios e
impuestos), **sin ninguna garantía de que el stock siga disponible** para el
momento en que el `syncManager` las drene y las cree en Odoo.

**Política aceptada** (no es un bug, es un trade-off documentado):

1. El backend (Odoo) **debe tolerar** la creación diferida de órdenes que
   pueden dejar el stock en negativo momentáneamente. `action_create_sale_order_from_pos`
   no debe rechazar la creación por falta de stock — hacerlo convertiría un
   rechazo de negocio en un caso más para encolar/reintentar, complicando el
   contrato de idempotencia (ver ADR-1 del design).
2. El riesgo es bajo en la práctica: la cola tiene un tope de 5 órdenes
   (`MAX_QUEUE_SIZE`), el drenado es secuencial (nunca paralelo, ver ADR-3), y
   los kioskos de autoservicio manejan volúmenes de venta acotados por
   estación.
3. Si el drift de stock se vuelve un problema operativo real, la solución
   correcta es agregar validación de stock del lado de Odoo en el momento de
   la creación diferida (fuera del alcance de este cambio) — **no** intentar
   validar stock del lado del kiosko con datos cacheados, que estarían
   igual de desactualizados.

## Dedup de `x_fex_id` — hardening pendiente (seguimiento, no bloqueante)

`eu_pos_base/models/sale_order.py:1240` hace un `search()` por `x_fex_id` antes
de `create()` (dedup a nivel de aplicación), pero **no existe una constraint
UNIQUE a nivel de base de datos** sobre ese campo. El riesgo de carrera se
acepta porque el kiosko drena la cola **secuencialmente, un ítem a la vez**
(nunca en paralelo — ver ADR-3), lo que hace que dos `create()` concurrentes
para el mismo `x_fex_id` sean, en la práctica, imposibles desde este cliente.
Se recomienda como mejora de backend (fuera de alcance) agregar la constraint
única para blindar contra otros clientes futuros que pudieran reenviar el
mismo `x_fex_id` en paralelo.

## Semántica de fallos del drain (ADR-3, resumen operativo)

| Tipo de error en `createSaleOrder` durante el drain | Efecto |
|---|---|
| `OdooServerError` (rechazo de negocio permanente) | Se marca el ítem `failed` (se conserva, no se borra — ya se imprimió un comprobante fiscal), se incrementa `attempts`, y el drain **continúa** con el siguiente ítem |
| Cualquier otro `Error` (red/timeout/5xx) | El ítem vuelve a `pending`, el drain se **detiene** por completo, y se reprograma un reintento con backoff (base 5s, factor 2, tope 60s, full jitter) |

Los ítems marcados `failed` requieren revisión manual — no se reintentan
automáticamente (evita reenviar indefinidamente una orden que Odoo ya rechazó
por una razón de negocio real).
