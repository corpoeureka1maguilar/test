import { describe, it, expect } from 'vitest'
import { sha256Hex, hashPin, verifyPinHash, isLegacyPinHash, randomUUID } from './cryptoUtils'

describe('cryptoUtils — sha256Hex', () => {
  // Vectores oficiales FIPS 180-4: si esto falla, los PIN legacy (SHA-256
  // plano guardados por versiones anteriores) dejarían de verificar
  it('matches the official SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('cryptoUtils — PIN hashing', () => {
  it('hashes with salt and verifies the same pin', () => {
    const stored = hashPin('1234')
    expect(stored.startsWith('v2:')).toBe(true)
    expect(verifyPinHash('1234', stored)).toBe(true)
    expect(verifyPinHash('9999', stored)).toBe(false)
  })

  it('produces different hashes for the same pin (random salt)', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'))
  })

  it('still verifies legacy unsalted SHA-256 hashes', () => {
    const legacy = sha256Hex('1234')
    expect(isLegacyPinHash(legacy)).toBe(true)
    expect(verifyPinHash('1234', legacy)).toBe(true)
    expect(verifyPinHash('0000', legacy)).toBe(false)
  })

  it('rejects empty stored hashes', () => {
    expect(verifyPinHash('1234', '')).toBe(false)
  })
})

describe('cryptoUtils — randomUUID', () => {
  it('returns RFC 4122 v4 formatted ids', () => {
    const id = randomUUID()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(randomUUID()).not.toBe(id)
  })
})
