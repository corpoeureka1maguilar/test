import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { RootLayout } from '@/shared/layouts/RootLayout'
import { Welcome } from '@/features/welcome/pages/Welcome'
import { Setup } from '@/features/setup/pages/Setup'
import { PrinterTest } from '@/features/setup/pages/PrinterTest'
import { CustomerIdentity } from '@/features/customer/pages/CustomerIdentity'
import { CustomerRegister } from '@/features/customer/pages/CustomerRegister'
import { ProductCatalog } from '@/features/catalog/pages/ProductCatalog'
import { CartReview } from '@/features/cart/pages/CartReview'
import { LoyaltyCheck } from '@/features/loyalty/pages/LoyaltyCheck'
import { PaymentSelect } from '@/features/payment/pages/PaymentSelect'
import { PaymentForm } from '@/features/payment/pages/PaymentForm'
import { PaymentResult } from '@/features/payment/pages/PaymentResult'
import { AdvancedMenu } from '@/features/advanced/pages/AdvancedMenu'

function RequireConfig({ children }: { children: React.ReactNode }) {
  const isConfigured = useConfigStore(s => s.isConfigured)
  return isConfigured ? <>{children}</> : <Navigate to="/setup" replace />
}

export const router = createBrowserRouter([
  {
    path: '/setup',
    element: <Setup />
  },
  {
    path: '/test-printer',
    element: <PrinterTest />
  },
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <RequireConfig><Welcome /></RequireConfig> },
      { path: '/cedula', element: <RequireConfig><CustomerIdentity /></RequireConfig> },
      { path: '/registro', element: <RequireConfig><CustomerRegister /></RequireConfig> },
      { path: '/productos', element: <RequireConfig><ProductCatalog /></RequireConfig> },
      { path: '/carrito', element: <RequireConfig><CartReview /></RequireConfig> },
      { path: '/lealtad', element: <RequireConfig><LoyaltyCheck /></RequireConfig> },
      { path: '/pago', element: <RequireConfig><PaymentSelect /></RequireConfig> },
      { path: '/pago/:methodId', element: <RequireConfig><PaymentForm /></RequireConfig> },
      { path: '/resultado', element: <RequireConfig><PaymentResult /></RequireConfig> },
      { path: '/advanced', element: <RequireConfig><AdvancedMenu /></RequireConfig> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

