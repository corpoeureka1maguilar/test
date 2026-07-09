import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_ACCENT, isValidHex, normalizeAccent, deriveAccentShades, applyAccentColor } from './theme'

describe('theme — isValidHex', () => {
  it('accepts a well-formed 6-digit hex with leading #', () => {
    expect(isValidHex('#10b981')).toBe(true)
  })

  it('rejects a value missing the leading #', () => {
    expect(isValidHex('10b981')).toBe(false)
  })

  it('rejects a value with the wrong length', () => {
    expect(isValidHex('#10b98')).toBe(false)
  })

  it('rejects a value with non-hex characters', () => {
    expect(isValidHex('#zzzzzz')).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(isValidHex(undefined)).toBe(false)
    expect(isValidHex(null)).toBe(false)
    expect(isValidHex(12345)).toBe(false)
  })

  it('rejects an empty or blank string', () => {
    expect(isValidHex('')).toBe(false)
    expect(isValidHex('   ')).toBe(false)
  })
})

describe('theme — normalizeAccent', () => {
  it('returns the lowercased valid hex when given a valid value', () => {
    expect(normalizeAccent('#10B981')).toBe('#10b981')
  })

  it('returns DEFAULT_ACCENT for an absent value', () => {
    expect(normalizeAccent(undefined)).toBe(DEFAULT_ACCENT)
  })

  it('returns DEFAULT_ACCENT for a malformed value', () => {
    expect(normalizeAccent('not-a-color')).toBe(DEFAULT_ACCENT)
  })

  it('returns DEFAULT_ACCENT for an empty value', () => {
    expect(normalizeAccent('')).toBe(DEFAULT_ACCENT)
  })
})

describe('theme — deriveAccentShades', () => {
  it('returns base equal to the input hex', () => {
    const shades = deriveAccentShades('#10b981')
    expect(shades.base).toBe('#10b981')
  })

  it('derives hover as a deterministic ~15% darken, not the hardcoded #059669', () => {
    const shades = deriveAccentShades('#10b981')
    // r=16,g=185,b=129 -> darken 15% -> round(16*0.85)=14(0x0e), round(185*0.85)=157(0x9d), round(129*0.85)=110(0x6e)
    expect(shades.hover).toBe('#0e9d6e')
  })

  it('derives glow as rgba with alpha 0.2', () => {
    const shades = deriveAccentShades('#10b981')
    expect(shades.glow).toBe('rgba(16, 185, 129, 0.2)')
  })

  it('derives subtle as rgba with alpha 0.05', () => {
    const shades = deriveAccentShades('#10b981')
    expect(shades.subtle).toBe('rgba(16, 185, 129, 0.05)')
  })
})

describe('theme — applyAccentColor', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--color-accent')
    document.documentElement.style.removeProperty('--color-accent-hover')
    document.documentElement.style.removeProperty('--color-accent-glow')
    document.documentElement.style.removeProperty('--color-accent-subtle')
  })

  it('sets --color-accent on the document root', () => {
    applyAccentColor('#10b981')
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#10b981')
  })

  it('sets --color-accent-hover on the document root', () => {
    applyAccentColor('#10b981')
    expect(document.documentElement.style.getPropertyValue('--color-accent-hover')).toBe('#0e9d6e')
  })

  it('sets --color-accent-glow on the document root', () => {
    applyAccentColor('#10b981')
    expect(document.documentElement.style.getPropertyValue('--color-accent-glow')).toBe('rgba(16, 185, 129, 0.2)')
  })

  it('sets --color-accent-subtle on the document root', () => {
    applyAccentColor('#10b981')
    expect(document.documentElement.style.getPropertyValue('--color-accent-subtle')).toBe('rgba(16, 185, 129, 0.05)')
  })
})
