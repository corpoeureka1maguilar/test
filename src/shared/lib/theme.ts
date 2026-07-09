// Color de acento configurable por estación (x.pos.station.action_get_custom_config
// -> x_accent_color). Ver openspec/changes/backend-accent-color para el contrato.

export const DEFAULT_ACCENT = '#10b981'

const HEX = /^#[0-9a-fA-F]{6}$/

export function isValidHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v)
}

export function normalizeAccent(v: unknown): string {
  return isValidHex(v) ? v.toLowerCase() : DEFAULT_ACCENT
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  }
}

function toHexByte(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

const HOVER_DARKEN_FACTOR = 0.85
const GLOW_ALPHA = 0.2
const SUBTLE_ALPHA = 0.05

export interface AccentShades {
  base: string
  hover: string
  glow: string
  subtle: string
}

export function deriveAccentShades(hex: string): AccentShades {
  const { r, g, b } = hexToRgb(hex)
  const hover = `#${toHexByte(r * HOVER_DARKEN_FACTOR)}${toHexByte(g * HOVER_DARKEN_FACTOR)}${toHexByte(b * HOVER_DARKEN_FACTOR)}`
  return {
    base: hex,
    hover,
    glow: `rgba(${r}, ${g}, ${b}, ${GLOW_ALPHA})`,
    subtle: `rgba(${r}, ${g}, ${b}, ${SUBTLE_ALPHA})`
  }
}

export function applyAccentColor(hex: string): void {
  const shades = deriveAccentShades(hex)
  const root = document.documentElement.style
  root.setProperty('--color-accent', shades.base)
  root.setProperty('--color-accent-hover', shades.hover)
  root.setProperty('--color-accent-glow', shades.glow)
  root.setProperty('--color-accent-subtle', shades.subtle)
}
