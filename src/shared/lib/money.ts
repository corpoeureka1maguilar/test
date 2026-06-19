import { dinero, add, subtract, multiply, toDecimal, type Dinero } from 'dinero.js'

export const VES = {
  code: 'VES',
  base: 10,
  exponent: 2,
}

export function ves(amount: number): Dinero<number> {
  return dinero({ amount: Math.round(amount * 100), currency: VES }) as Dinero<number>
}

export function toFloat(d: Dinero<number>): number {
  return parseFloat(toDecimal(d))
}

export function addVES(d1: Dinero<number>, d2: Dinero<number>): Dinero<number> {
  return add(d1, d2) as Dinero<number>
}

export function subVES(d1: Dinero<number>, d2: Dinero<number>): Dinero<number> {
  return subtract(d1, d2) as Dinero<number>
}

export function mulVES(d: Dinero<number>, multiplier: number): Dinero<number> {
  return multiply(d, { amount: Math.round(multiplier * 100), scale: 2 }) as Dinero<number>
}

export function formatBs(amount: number): string {
  return formatVES(ves(amount))
}

export function formatVES(d: Dinero<number>): string {
  return toDecimal(d, ({ value, currency }) => {
    const [intPart, decPart = ''] = value.split('.')
    const paddedDec = decPart.padEnd(currency.exponent, '0')
    const formattedInt = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseInt(intPart, 10))
    return `Bs. ${formattedInt},${paddedDec}`
  })
}
