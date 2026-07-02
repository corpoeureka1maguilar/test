export type PaymentType =
  | 'cash'
  | 'pago_movil'
  | 'card'
  | 'transferencia'
  | 'crypto'
  | 'zelle'
  | 'otro'
  | 'biopago'
  | 'banplus'

export interface KioskPartner {
  id: number
  name: string
  cedula: string
  phone?: string
  street?: string
}

export interface KioskProduct {
  id: number
  name: string
  defaultCode: string
  barcode?: string
  price: number
  priceUsd: number
  taxRate: number
  categId: number
  categName: string
  uomName: string
}

export interface CartItem {
  productId: number
  name: string
  defaultCode: string
  price: number
  priceUsd: number
  taxRate: number
  qty: number
  subtotal: number
}

export interface KioskPaymentMethod {
  id: number
  name: string
  paymentType: PaymentType
  applyIgtf: boolean
  igtfPercent: number
  journalId: number
  currencyId: number       // requerido por account_payment_fex.currency_id (NOT NULL)
  currencyName?: string
  currencySymbol?: string
  currencyRate?: number
  useForChange: boolean
}

export interface ActivePayment {
  methodId: number
  reference: string
  bank?: string
  phone?: string
  amount: number
  igtfAmount: number
}

export interface PrinterApiResponse {
  numNota?: string
  numReporte?: string
  numfactura?: string
  fecha: string
  hora: string
  indimpresion: string
  serial: string
  error?: Record<string, unknown>
}

export interface PrinterInvoiceData {
  code: string
  date: string
  serial: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  sticky?: boolean
}

// Mantenidos para AdvancedMenu.tsx
export interface KioskOrderLine {
  id: number
  productId: [number, string]
  productUomQty: number
  priceUnit: number
  priceSubtotal: number
}

export interface KioskOrder {
  id: number
  name: string
  partnerId: [number, string]
  partner?: KioskPartner
  amountTotal: number
  xFexId: string
  orderLine: number[]
  lines?: KioskOrderLine[]
  state: string
  /** N° de la factura fiscal (x_printer_number); sin él no hay reimpresión */
  printerNumber?: string
}

export interface AdConfig {
  type: 'image' | 'video' | 'gradient'
  url?: string
  title?: string
  description?: string
  colorStart?: string
  colorEnd?: string
  active: boolean
}

