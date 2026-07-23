// Caché offline del catálogo (productos + métodos de pago) sobre IndexedDB.
//
// Política "keep last known good": el reemplazo es SIEMPRE completo (no hay
// merge incremental), pero un fetch fallido nunca debe llamar a estas
// funciones — el caller (useProducts / hook de métodos de pago) decide
// cuándo refrescar. Si la escritura choca con QuotaExceededError, el caché
// previo se conserva intacto (ver `putCapped` en idbStore.ts).

import { CATALOG_STORE, putCapped, getRecord, getInstanceKey } from './idbStore'

const MAX_ENTRIES = 5000

type CatalogKind = 'products' | 'paymentMethods'

interface CatalogRow<T> {
  kind: CatalogKind
  items: T[]
  updatedAt: number
  instanceKey?: string | undefined  // ausente = fila legacy pre-scoping (design ADR-6); se taggea lazily
}

async function replaceCatalog<T>(kind: CatalogKind, items: T[]): Promise<boolean> {
  const capped = items.length > MAX_ENTRIES ? items.slice(0, MAX_ENTRIES) : items
  const instanceKey = getInstanceKey()
  return putCapped(CATALOG_STORE, {
    kind,
    items: capped,
    updatedAt: Date.now(),
    instanceKey: instanceKey ?? undefined
  } satisfies CatalogRow<T>)
}

// Instance scoping (design ADR-6): sin instancia configurada, nunca se sirve
// caché. Una fila de OTRA instancia tampoco se sirve. Una fila legacy sin
// `instanceKey` se sirve UNA vez y queda tagueada con la instancia vigente
// para no filtrarse a una instancia distinta más adelante.
async function getCatalog<T>(kind: CatalogKind): Promise<T[]> {
  const instanceKey = getInstanceKey()
  if (instanceKey === null) return []

  const row = await getRecord<CatalogRow<T>>(CATALOG_STORE, kind)
  if (!row) return []

  if (row.instanceKey === undefined) {
    await putCapped(CATALOG_STORE, { ...row, instanceKey } satisfies CatalogRow<T>)
    return row.items
  }

  if (row.instanceKey !== instanceKey) return []

  return row.items
}

export async function replaceProducts<T>(products: T[]): Promise<boolean> {
  return replaceCatalog('products', products)
}

export async function getProducts<T>(): Promise<T[]> {
  return getCatalog<T>('products')
}

export async function replacePaymentMethods<T>(methods: T[]): Promise<boolean> {
  return replaceCatalog('paymentMethods', methods)
}

export async function getPaymentMethods<T>(): Promise<T[]> {
  return getCatalog<T>('paymentMethods')
}
