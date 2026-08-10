import { describe, it, expect } from 'vitest'
import { sha256Hex, iteratedHash, PIN_HASH_ITERATIONS, randomUUID } from './cryptoUtils'

describe('cryptoUtils — sha256Hex', () => {
  // Vectores oficiales FIPS 180-4: iteratedHash (y con él toda la validación
  // offline de PIN) se apoya en esta implementación pura de SHA-256
  it('matches the official SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('cryptoUtils — iteratedHash', () => {
  // Vectores calculados con `_kiosk_pin_hash` de
  // eu_autopay_bridge/models/x_pos_cashier.py. Este test es el contrato entre
  // las dos implementaciones: si Odoo y el kiosco dejan de producir el mismo
  // hex, TODA validación offline de PIN empieza a rechazar passwords válidos y
  // el kiosco se vuelve inoperable cuando se cae la red.
  it('matches the hashes produced by the Odoo side', () => {
    expect(iteratedHash('1234', 'a1b2c3d4', 1))
      .toBe('ceaa4a9eadf93bacf9ab0feb0835a5285bc1aefabbc6590feb507861a24f11a0')
    expect(iteratedHash('1234', 'a1b2c3d4', 3))
      .toBe('17acc3e483586973cd2c43fb3913dad66a037b014fd781927ca081cbfe30f931')
  })

  it('is deterministic per (pin, salt, iterations) and separates all three', () => {
    expect(iteratedHash('1234', 'salt', 5)).toBe(iteratedHash('1234', 'salt', 5))
    expect(iteratedHash('1234', 'salt', 5)).not.toBe(iteratedHash('9999', 'salt', 5))
    expect(iteratedHash('1234', 'salt', 5)).not.toBe(iteratedHash('1234', 'otro', 5))
    expect(iteratedHash('1234', 'salt', 5)).not.toBe(iteratedHash('1234', 'salt', 6))
  })

  it('uses enough iterations to make a 4-digit brute force expensive', () => {
    expect(PIN_HASH_ITERATIONS).toBeGreaterThanOrEqual(50_000)
  })
})

describe('cryptoUtils — randomUUID', () => {
  it('returns RFC 4122 v4 formatted ids', () => {
    const id = randomUUID()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(randomUUID()).not.toBe(id)
  })
})
