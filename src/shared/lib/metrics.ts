import type { CartItem } from '@/shared/types/types'

export interface ViewMetrics {
  [path: string]: number
}

export interface PaymentMethodMetric {
  count: number
  amount: number
}

export interface ProductMetric {
  name: string
  qty: number
}

export interface AutopayMetrics {
  views: ViewMetrics
  sales: {
    totalAmount: number
    orderCount: number
    refundCount: number
    paymentMethods: Record<string, PaymentMethodMetric>
    topProducts: Record<string, ProductMetric>
    trackedOrders: string[]
  }
}

const STORAGE_KEY = 'fex_autopay_metrics'

const INITIAL_METRICS: AutopayMetrics = {
  views: {},
  sales: {
    totalAmount: 0,
    orderCount: 0,
    refundCount: 0,
    paymentMethods: {},
    topProducts: {},
    trackedOrders: []
  }
}

export function getMetrics(): AutopayMetrics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...INITIAL_METRICS }
    }
    const parsed = JSON.parse(raw)
    // Asegurar estructura
    return {
      views: parsed.views || {},
      sales: {
        totalAmount: parsed.sales?.totalAmount || 0,
        orderCount: parsed.sales?.orderCount || 0,
        refundCount: parsed.sales?.refundCount || 0,
        paymentMethods: parsed.sales?.paymentMethods || {},
        topProducts: parsed.sales?.topProducts || {},
        trackedOrders: parsed.sales?.trackedOrders || []
      }
    }
  } catch (e) {
    console.error('Error reading metrics from localStorage', e)
    return { ...INITIAL_METRICS }
  }
}

export function saveMetrics(metrics: AutopayMetrics): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
  } catch (e) {
    console.error('Error saving metrics to localStorage', e)
  }
}

export function trackView(path: string): void {
  // Simplificar rutas para que se agrupen de forma legible
  let viewKey = path
  if (path.startsWith('/pago/')) {
    viewKey = '/pago/:methodId'
  }

  const metrics = getMetrics()
  metrics.views[viewKey] = (metrics.views[viewKey] || 0) + 1
  saveMetrics(metrics)
}

export function trackSale(
  orderRef: string,
  amount: number,
  paymentMethodName: string,
  items: CartItem[]
): void {
  if (!orderRef) return
  const metrics = getMetrics()

  // Evitar duplicación
  if (metrics.sales.trackedOrders.includes(orderRef)) {
    return
  }

  metrics.sales.trackedOrders.push(orderRef)
  metrics.sales.totalAmount += amount
  metrics.sales.orderCount += 1

  // Métodos de pago
  const currentMethod = metrics.sales.paymentMethods[paymentMethodName] || { count: 0, amount: 0 }
  metrics.sales.paymentMethods[paymentMethodName] = {
    count: currentMethod.count + 1,
    amount: currentMethod.amount + amount
  }

  // Productos
  items.forEach((item) => {
    const key = String(item.productId)
    const currentProd = metrics.sales.topProducts[key] || { name: item.name, qty: 0 }
    metrics.sales.topProducts[key] = {
      name: item.name,
      qty: currentProd.qty + item.qty
    }
  })

  saveMetrics(metrics)
}

export function trackRefund(): void {
  const metrics = getMetrics()
  metrics.sales.refundCount += 1
  saveMetrics(metrics)
}

export function resetMetrics(): void {
  saveMetrics({
    views: {},
    sales: {
      totalAmount: 0,
      orderCount: 0,
      refundCount: 0,
      paymentMethods: {},
      topProducts: {},
      trackedOrders: []
    }
  })
}
