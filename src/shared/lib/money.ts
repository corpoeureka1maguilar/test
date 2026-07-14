import { dinero, add, subtract, multiply, toDecimal, type Dinero } from 'dinero.js'

export const VES = {
  code: 'VES',
  base: 10,
  exponent: 2,
}

export type VESDinero = Dinero<number>

export function ves(amount: number): VESDinero {
  return dinero({ amount: Math.round(amount * 100), currency: VES })
}

export function toFloat(d: VESDinero): number {
  return parseFloat(toDecimal(d))
}

export function addVES(d1: VESDinero, d2: VESDinero): VESDinero {
  return add(d1, d2)
}

export function subVES(d1: VESDinero, d2: VESDinero): VESDinero {
  return subtract(d1, d2)
}

export function mulVES(d: VESDinero, multiplier: number): VESDinero {
  return multiply(d, { amount: Math.round(multiplier * 100), scale: 2 })
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatBs(amount: number): string {
  return formatVES(ves(amount))
}

export function formatVES(d: VESDinero): string {
  return toDecimal(d, ({ value, currency }) => {
    const [intPart, decPart = ''] = value.split('.')
    const paddedDec = decPart.padEnd(currency.exponent, '0')
    const formattedInt = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseInt(intPart, 10))
    return `Bs.${formattedInt},${paddedDec}`
  })
}
