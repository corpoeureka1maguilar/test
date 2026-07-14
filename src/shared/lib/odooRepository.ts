// ─── Fachada de compatibilidad ────────────────────────────────────────────────
// Este archivo re-exporta la API pública de src/shared/lib/odoo/*, dividida por
// dominio. Se mantiene para que ningún import existente en el proyecto
// (`@/shared/lib/odooRepository`) necesite cambiar. No agregar lógica acá:
// cualquier función nueva va en su archivo de dominio correspondiente dentro
// de src/shared/lib/odoo/.

export type { CreatePartnerInput } from './odoo/customerRepository'
export { searchPartnerByCedula, createPartner } from './odoo/customerRepository'

export { fetchPaymentMethods } from './odoo/paymentMethodRepository'

export { fetchExchangeRate, fetchProducts } from './odoo/catalogRepository'

export {
  createSaleOrder,
  fetchOrder,
  searchOrders,
  returnOrder,
  setRefundCodeToInvoices,
  setOrderPrinterData
} from './odoo/saleRepository'

export type { KioskOperationRef, KioskAdminCheck } from './odoo/adminRepository'
export { KIOSK_OPERATIONS, checkKioskAdmin } from './odoo/adminRepository'

export type { OdooState } from './odoo/branchRepository'
export {
  fetchCompanyLogo,
  fetchAdvertisements,
  fetchBranchState,
  fetchBranchFixedProducts,
  fetchBranchDefaultPricelist,
  fetchStates
} from './odoo/branchRepository'

export type { KioskStation, LinkedStation } from './odoo/stationRepository'
export {
  fetchStations,
  linkStation,
  pingStation,
  fetchActiveSession,
  openOdooSession,
  closeOdooSession,
  fetchCashier
} from './odoo/stationRepository'

export { syncMetrics } from './odoo/metricsRepository'

export type { AssignCardFromSaleInput } from './odoo/giftCardRepository'
export { searchGiftCard, assignCardFromSale } from './odoo/giftCardRepository'
