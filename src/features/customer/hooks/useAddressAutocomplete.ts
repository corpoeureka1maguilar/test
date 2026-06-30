import { useState, useRef, useCallback } from 'react'

interface PhotonFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: [number, number] }
  properties: {
    osm_id: number
    name?: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    country?: string
    country_code?: string
    postcode?: string
  }
}

export interface AddressSuggestion {
  id: number
  label: string
  street: string
  estado: string
}

// Bounding box de Venezuela para filtrar resultados
const VE_BBOX = '-73.35,0.64,-59.77,12.2'

function extractFields(f: PhotonFeature, index: number): AddressSuggestion {
  const p = f.properties
  const parts = [p.housenumber, p.street ?? p.name, p.city].filter(Boolean)
  const street = parts.join(', ') || p.name || ''
  const label = [street, p.state, p.country].filter(Boolean).join(', ')

  return {
    id: p.osm_id ?? index,
    label,
    street,
    estado: p.state ?? ''
  }
}

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimer = useRef<number | null>(null)
  const abortController = useRef<AbortController | null>(null)

  const search = useCallback((query: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (query.length < 3) {
      setSuggestions([])
      return
    }

    debounceTimer.current = window.setTimeout(async () => {
      if (abortController.current) abortController.current.abort()
      abortController.current = new AbortController()

      setIsLoading(true)
      try {
        const url = new URL('https://photon.komoot.io/api/')
        url.searchParams.set('q', query)
        url.searchParams.set('limit', '5')
        url.searchParams.set('bbox', VE_BBOX)

        const res = await fetch(url.toString(), { signal: abortController.current.signal })
        const data: { features: PhotonFeature[] } = await res.json()
        setSuggestions((data.features ?? []).map(extractFields))
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setSuggestions([])
        }
      } finally {
        setIsLoading(false)
      }
    }, 400)
  }, [])

  const clear = useCallback(() => {
    setSuggestions([])
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  return { suggestions, isLoading, search, clear }
}
