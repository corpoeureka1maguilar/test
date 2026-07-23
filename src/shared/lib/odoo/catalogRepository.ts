import { odooEnv } from '@/shared/lib/odooEnv'
import { useConfigStore } from '@/shared/stores/config'
import type { KioskProduct } from '@/shared/types/types'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

interface RawProduct {
  id: number
  name: string
  default_code: string | false
  barcode: string | false
  list_price: number
  taxes_id: number[]
  categ_id: [number, string]
  uom_id: [number, string]
}

interface RawBarcodeMulti {
  product_id: [number, string]
  name: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapProduct(r: RawProduct, taxRateMap: Map<number, number>, secondaryBarcodesMap: Map<number, string>): KioskProduct {
  const firstTaxId = r.taxes_id?.[0]
  const taxRate = firstTaxId !== undefined ? (taxRateMap.get(firstTaxId) ?? 0.16) : 0.16
  // Los códigos secundarios (product.barcode.multi) se anexan al barcode principal
  // separados por coma; matchBarcode/matchBarcodeIncludes ya soportan ese formato
  const barcode = [r.barcode || undefined, secondaryBarcodesMap.get(r.id)].filter(Boolean).join(',')
  const giftCardProductId = useConfigStore.getState().giftCardProductId
  return {
    id: r.id,
    name: r.name,
    defaultCode: r.default_code || '',
    barcode: barcode || undefined,
    price: r.list_price,
    priceUsd: r.list_price,
    taxRate,
    categId: r.categ_id[0],
    categName: r.categ_id[1],
    uomName: r.uom_id[1],
    isGiftCard: r.id === giftCardProductId
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

const PRODUCT_FIELDS = ['id', 'name', 'default_code', 'barcode', 'list_price', 'taxes_id', 'categ_id', 'uom_id']

// Tope de resultados de la búsqueda online (espeja PRODUCT_LIMIT del backend
// en eu_pos_base/models/product.py). La búsqueda manual no necesita traer el
// catálogo entero, solo las coincidencias del patrón.
const SEARCH_LIMIT = 50

// Mismo dominio base que el catálogo (fetchProducts): así la búsqueda online es
// una extensión real del catálogo — encuentra CUALQUIER producto elegible, no
// solo los 200 precargados. Si un producto no aparece ni con esto, la causa es
// de datos (list_price 0 o invoice_policy != 'order'), no de la búsqueda.
const CATALOG_BASE_DOMAIN = [
  ['sale_ok', '=', true],
  ['active', '=', true],
  ['invoice_policy', '=', 'order']
]

// Sin catch: quien la llama decide qué hacer con el fallo (no todo fallo debe
// pisar la última tasa buena conocida — ver fetchProducts más abajo)
export async function fetchExchangeRate(): Promise<number> {
  return odooEnv.callMethod<number>('res.currency', 'action_get_rate')
}

// Enriquecimiento común a catálogo y búsqueda: tasas de impuesto, códigos de
// barra secundarios y precios de pricelist, aplicando la tasa de cambio. Un
// fallo en cualquier lookup auxiliar degrada ese dato pero no rompe el mapeo.
async function enrichProducts(raw: RawProduct[], pricelistId: number, rate: number): Promise<KioskProduct[]> {
  // Batch-fetch tax rates for all unique tax IDs
  const taxRateMap = new Map<number, number>()
  const uniqueTaxIds = [...new Set(raw.flatMap(r => r.taxes_id ?? []))]
  if (uniqueTaxIds.length > 0) {
    try {
      const taxes = await odooEnv.callMethod<{ id: number; amount: number }[]>(
        'account.tax', 'search_read',
        [[['id', 'in', uniqueTaxIds]]],
        { fields: ['id', 'amount'] }
      )
      for (const t of taxes) {
        taxRateMap.set(t.id, t.amount / 100)
      }
    } catch (err) {
      console.error('[enrichProducts] Error fetching tax rates:', err)
    }
  }

  // Códigos de barra secundarios (módulo product_multiple_barcodes); un producto
  // sin código secundario simplemente no aparece en el resultado, de ahí el Map
  const secondaryBarcodesMap = new Map<number, string>()
  if (raw.length > 0) {
    try {
      const barcodesMulti = await odooEnv.callMethod<RawBarcodeMulti[]>(
        'product.barcode.multi', 'search_read',
        [[['product_id', 'in', raw.map(r => r.id)]]],
        { fields: ['product_id', 'name'] }
      )
      for (const b of barcodesMulti) {
        const productId = b.product_id[0]
        const existing = secondaryBarcodesMap.get(productId)
        secondaryBarcodesMap.set(productId, existing ? `${existing},${b.name}` : b.name)
      }
    } catch (err) {
      console.error('[enrichProducts] Error fetching secondary barcodes:', err)
    }
  }

  // Si la sucursal tiene una pricelist por defecto, sus reglas priman sobre
  // list_price; un fallo acá no bloquea el catálogo, solo deja list_price
  const pricelistPriceMap = new Map<number, number>()
  if (pricelistId && raw.length > 0) {
    try {
      const prices = await odooEnv.callMethod<Record<string, number>>(
        'product.product', 'action_get_prices_by_pricelist',
        [raw.map(r => r.id), pricelistId]
      )
      for (const [id, price] of Object.entries(prices)) {
        pricelistPriceMap.set(Number(id), price)
      }
    } catch (err) {
      console.error('[enrichProducts] Error fetching pricelist prices:', err)
    }
  }

  return raw.map(r => {
    const p = mapProduct(r, taxRateMap, secondaryBarcodesMap)
    const basePriceUsd = pricelistPriceMap.get(r.id) ?? p.price
    p.priceUsd = basePriceUsd
    // Cualquier tasa positiva es válida (una tasa legítima puede ser ≤ 1);
    // solo se omite el 0/negativo que indicaría un dato corrupto del backend
    p.price = rate > 0 ? basePriceUsd * rate : basePriceUsd
    return p
  })
}

/**
 * Búsqueda online contra TODO el catálogo por nombre, código o código de barras
 * (ilike), no solo sobre los 200 productos precargados. El caller decide el
 * fallback offline: si esta promesa rechaza (red caída), useProductSearch cae
 * al filtro local sobre el caché. La tasa se lee del store (última buena
 * conocida, refrescada por el poll del catálogo) para no gastar un RPC por tecla.
 */
export async function searchProducts(pattern: string, pricelistId = 0): Promise<KioskProduct[]> {
  const query = pattern.trim()
  if (!query) return []

  const raw = await odooEnv.callMethod<RawProduct[]>(
    'product.product', 'search_read',
    [[
      ...CATALOG_BASE_DOMAIN,
      '|', '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
      ['barcode', 'ilike', query]
    ]],
    { fields: PRODUCT_FIELDS, limit: SEARCH_LIMIT }
  )
  if (raw.length === 0) return []

  const { useExchangeRateStore } = await import('@/shared/stores/exchangeRate')
  const rate = useExchangeRateStore.getState().rate
  return enrichProducts(raw, pricelistId, rate)
}

export async function fetchProducts(fixedProductIds: number[] = [], pricelistId = 0): Promise<KioskProduct[]> {
  let rateFetchFailed = false
  const [raw, rate] = await Promise.all([
    odooEnv.callMethod<RawProduct[]>(
      'product.product', 'search_read',
      [[...CATALOG_BASE_DOMAIN]],
      { fields: PRODUCT_FIELDS, limit: 200 }
    ),
    fetchExchangeRate().catch((err) => {
      console.error('[fetchProducts] Error fetching currency rate:', err)
      rateFetchFailed = true
      return 1
    })
  ])

  // Los productos fijos de la sucursal deben estar siempre disponibles,
  // aunque el dominio o el límite del catálogo los haya dejado fuera
  const missingFixedIds = fixedProductIds.filter(id => !raw.some(r => r.id === id))
  if (missingFixedIds.length > 0) {
    try {
      const fixedRaw = await odooEnv.callMethod<RawProduct[]>(
        'product.product', 'search_read',
        [[['id', 'in', missingFixedIds]]],
        { fields: PRODUCT_FIELDS }
      )
      raw.push(...fixedRaw)
    } catch (err) {
      console.error('[fetchProducts] Error fetching branch fixed products:', err)
    }
  }

  // Persistir la tasa globalmente (para otras pantallas como /advanced y para
  // searchProducts), pero solo si el fetch fue exitoso: nunca pisar la última
  // tasa buena conocida con el fallback de 1 usado solo para no romper el
  // cálculo de precios acá
  if (!rateFetchFailed) {
    const { useExchangeRateStore } = await import('@/shared/stores/exchangeRate')
    useExchangeRateStore.getState().setRate(rate)
  }

  return enrichProducts(raw, pricelistId, rate)
}
