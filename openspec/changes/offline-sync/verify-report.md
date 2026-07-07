# Verify Report — offline-sync

**Status**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)
**Fecha**: 2026-07-06
**Fuente**: fase sdd-verify (contenido completo también en Engram, topic_key `sdd/offline-sync/verify-report`, obs #370)

## Resumen ejecutivo

211/211 tests en verde, typecheck limpio salvo un error pre-existente ajeno al cambio, 24/26 escenarios de spec con evidencia de test directa (2 parciales/estructurales).

## Resultados ejecutados en vivo

```
npm test -- --run
 Test Files  29 passed (29)
 Tests  211 passed (211)

npm run typecheck
src/features/welcome/components/WelcomeAd.tsx(15,10): error TS6133: 'progress' is declared but its value is never read.
```

El error de typecheck es pre-existente y está fuera del alcance (deviación aceptada #5).

## Evidencia clave verificada en código

- Tope de 5000 productos: `src/shared/lib/offlineCache.ts:19` (`MAX_ENTRIES = 5000`, `items.slice(0, MAX_ENTRIES)`)
- Cola máx. 5: `src/shared/lib/orderQueue.ts` (`MAX_QUEUE_SIZE = 5`, chequeo atómico dentro de una transacción readwrite)
- Idempotencia `x_fex_id`: `syncManager.ts:84` reenvía el payload original intacto a `createSaleOrder`
- Flujo `enqueuingOffline` → impresión fiscal: `src/features/payment/machines/saleMachine.ts` (guard `isDeferrableError`, `patchQueueFiscal` en `printing.onDone`)
- Regla de bloqueo: `src/shared/hooks/useShouldBlockUI.ts:17` — `isConfigured && isOffline && count >= MAX_QUEUE_SIZE`
- Sincronizador: `syncManager.ts` — drenaje secuencial, semántica ADR-3 (permanente → `markFailed` + continúa; transitorio → `pending` + backoff + corta), backoff exponencial con jitter (base 5s, ×2, tope 60s), recuperación al boot vía `resetDrainingToPending()`
- Cuota de storage: `idbStore.ts:56-70` (`isQuotaExceededError` + `putCapped` preserva datos previos ante fallo)

Las 6 deviaciones aceptadas están presentes en código y documentadas.

## Hallazgos

### CRITICAL
Ninguno.

### WARNING
1. Dedup de `x_fex_id` en backend es solo a nivel de aplicación (sin unique constraint en DB) — riesgo aceptado por drenaje secuencial de un solo kiosco; seguimiento en `docs/offline-sync.md`.
2. Dos escenarios de spec ("Empty cache offline" de productos y "Queue survives reload") son estructuralmente correctos pero no tienen un test nombrado que calce exacto con la redacción del spec.

### SUGGESTION
1. Agregar test explícito "queue survives reload" para trazabilidad spec↔test.
2. Registrar como deuda de hardening el unique constraint sobre `x_fex_id` en `eu_pos_base`.

## Próximo paso recomendado

`sdd-archive` (sin bloqueantes) — pendiente de commit/PR y de la prueba manual 4.4 (kiosco + impresora física) como gate pre-producción.
