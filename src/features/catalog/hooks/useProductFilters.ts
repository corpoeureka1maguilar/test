import { useMemo, useState } from 'react'
import type { KioskProduct } from '@/shared/types/types'
import { matchBarcodeIncludes } from '@/shared/lib/paymentUtils'

export interface ProductCategory {
  id: number
  name: string
}

/**
 * Filtrado del catálogo por categoría activa y búsqueda (con limpieza de
 * rebotes de doble-lectura del scanner). Limita el listado final a 20
 * productos para la búsqueda manual (ver commit de altura fija de cards).
 */
export function useProductFilters(products: KioskProduct[], debouncedSearch: string) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)

  const categories = useMemo<ProductCategory[]>(() => {
    const map = new Map<number, string>()
    products.forEach(p => map.set(p.categId, p.categName))
    return [...map.entries()]
      .map(([id, name]) => ({ id, name: name ?? '' }))
      .filter(c => c.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const filtered = useMemo(() => {
    let list = products
    if (activeCategoryId !== null) list = list.filter(p => p.categId === activeCategoryId)
    if (debouncedSearch.trim()) {
      const originalQ = debouncedSearch.trim().toLowerCase()

      // También limpiamos rebotes al buscar/filtrar
      let cleanedQ = originalQ
      if (originalQ.length % 2 === 0) {
        const half = originalQ.length / 2
        if (originalQ.slice(half) === originalQ.slice(0, half)) {
          cleanedQ = originalQ.slice(0, half)
        }
      }

      list = list.filter(p =>
        p.name.toLowerCase().includes(cleanedQ) ||
        p.defaultCode.toLowerCase().includes(cleanedQ) ||
        matchBarcodeIncludes(p.barcode, cleanedQ)
      )
    }
    return list.slice(0, 20)
  }, [products, activeCategoryId, debouncedSearch])

  return { activeCategoryId, setActiveCategoryId, categories, filtered }
}
