import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useProducts } from '@/features/catalog/hooks/useProducts'
import { useBarcodeScanner } from '@/features/catalog/hooks/useBarcodeScanner'
import { useProductFilters } from '@/features/catalog/hooks/useProductFilters'
import { useProductNotFoundAlert } from '@/features/catalog/hooks/useProductNotFoundAlert'
import { useCatalogCart } from '@/features/catalog/hooks/useCatalogCart'
import { useCartTotal, useCartCount, useCartSubtotal, useCartTaxBreakdown } from '@/features/cart/stores/cart'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { HiddenScannerInput } from '@/features/catalog/components/HiddenScannerInput'
import { ScannerPanel } from '@/features/catalog/components/ScannerPanel'
import { ManualSearchModal } from '@/features/catalog/components/ManualSearchModal'
import { CartSidebar } from '@/features/catalog/components/CartSidebar'
import { MobileCheckoutBar } from '@/features/catalog/components/MobileCheckoutBar'
import { NotFoundToast } from '@/features/catalog/components/NotFoundToast'
import { GiftCardAmountModal } from '@/features/catalog/components/GiftCardAmountModal'
import { BarcodeIcon, MagnifyingGlass } from '@phosphor-icons/react'

import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { matchBarcode } from '@/shared/lib/paymentUtils'
import styles from './ProductCatalog.module.css'

export function ProductCatalog() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()
  const total = useCartTotal()
  const subtotal = useCartSubtotal()
  const taxBreakdown = useCartTaxBreakdown()
  const count = useCartCount()
  const rate = useExchangeRateStore((s) => s.rate)

  const {
    items,
    setQty,
    removeItem,
    lastScannedProduct,
    setLastScannedProduct,
    isBouncing,
    showGiftCardModal,
    setShowGiftCardModal,
    giftCardAmountStr,
    setGiftCardAmountStr,
    setPendingGiftCardProduct,
    handleAddItem,
    handleGiftCardConfirm,
    getQty
  } = useCatalogCart(products)

  const {
    searchRef,
    search,
    setSearch,
    debouncedSearch,
    isManualMode,
    setIsManualMode,
    showKeyboard,
    setShowKeyboard,
    isKeyboardMinimized,
    setIsKeyboardMinimized,
    handleWrapperClick
  } = useBarcodeScanner()

  const { activeCategoryId, setActiveCategoryId, categories, filtered } = useProductFilters(products, debouncedSearch)

  const { showNotFoundAlert, notFoundCode, triggerNotFound } = useProductNotFoundAlert()

  const processSearchSubmit = () => {
    const originalQ = search.trim().toLowerCase()
    if (!originalQ) return

    // Intentar coincidencia exacta con el código original
    let exactMatch = products.find(p =>
      p.defaultCode?.toLowerCase() === originalQ ||
      matchBarcode(p.barcode, originalQ)
    )

    // Si no encuentra, verificar si es un código de barras duplicado/doble (bounce del scanner)
    if (!exactMatch && originalQ.length % 2 === 0) {
      const half = originalQ.length / 2
      const cleanedQ = originalQ.slice(0, half)
      if (originalQ.slice(half) === cleanedQ) {
        exactMatch = products.find(p =>
          p.defaultCode?.toLowerCase() === cleanedQ ||
          matchBarcode(p.barcode, cleanedQ)
        )
      }
    }

    if (exactMatch) {
      handleAddItem(exactMatch)
    } else {
      triggerNotFound(originalQ)
    }
    setSearch('') // Limpiar siempre el input para el próximo escaneo
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processSearchSubmit()
    }
  }

  const handleCheckout = () => {
    if (items.length === 0) return
    send({ type: 'CHECKOUT', cart: items })
    navigate('/lealtad')
  }

  return (
    <div
      className={`${styles.wrapper} ${styles.scanMode} ${showKeyboard && isManualMode ? (isKeyboardMinimized ? styles.keyboardMinimized : styles.keyboardOpen) : ''}`}
      onClick={handleWrapperClick}
    >
      {/* INPUT OCULTO PARA EL SCANNER FÍSICO CUANDO EL MODAL ESTÁ CERRADO */}
      {!isManualMode && (
        <HiddenScannerInput
          searchRef={searchRef}
          search={search}
          setSearch={setSearch}
          handleKeyDown={handleKeyDown}
        />
      )}

      {/* SECCIÓN IZQUIERDA: ZONA DE OPERACIÓN (ESCANEO / BÚSQUEDA) */}
      <div className={styles.leftSection}>
        <ScannerPanel
          lastScannedProduct={lastScannedProduct}
          getQty={getQty}
          setQty={setQty}
          removeItem={removeItem}
          setLastScannedProduct={setLastScannedProduct}
        />
      </div>
      {/* SECCIÓN DERECHA: CARRITO LATERAL INTEGRADO EN CALIENTE */}
      <div className={styles.rightSection}>
        <button
          type="button"
          className={`${styles.manualToggleBtn} ${isManualMode ? styles.active : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const newMode = !isManualMode;
            setIsManualMode(newMode);
            setShowKeyboard(newMode);
          }}
        >
          {isManualMode ? (
            <>
              <BarcodeIcon size={20} /> Escanear Productos
            </>
          ) : (
            <>
              <MagnifyingGlass size={20} /> Buscar Manualmente
            </>
          )}
        </button>
      {/* MODAL DE BÚSQUEDA MANUAL */}
      {isManualMode && (
        <ManualSearchModal
          searchRef={searchRef}
          search={search}
          setSearch={setSearch}
          handleKeyDown={handleKeyDown}
          setShowKeyboard={setShowKeyboard}
          setIsKeyboardMinimized={setIsKeyboardMinimized}
          onClose={() => setIsManualMode(false)}
          categories={categories}
          activeCategoryId={activeCategoryId}
          setActiveCategoryId={setActiveCategoryId}
          isLoading={isLoading}
          filtered={filtered}
          getQty={getQty}
          setQty={setQty}
          removeItem={removeItem}
          handleAddItem={handleAddItem}
          lastScannedProduct={lastScannedProduct}
          setLastScannedProduct={setLastScannedProduct}
        />
      )}
        <CartSidebar
          items={items}
          count={count}
          setQty={setQty}
          removeItem={removeItem}
          lastScannedProduct={lastScannedProduct}
          setLastScannedProduct={setLastScannedProduct}
          subtotal={subtotal}
          taxBreakdown={taxBreakdown}
          total={total}
          rate={rate}
          isBouncing={isBouncing}
          onCancel={() => {
            send({ type: 'RESET' });
            navigate('/')
          }}
          onCheckout={handleCheckout}
        />
      </div>

      {/* Mobile Sticky Checkout Bar */}
      {items.length > 0 && (!showKeyboard || !isManualMode) && (
        <MobileCheckoutBar
          count={count}
          total={total}
          rate={rate}
          onCheckout={handleCheckout}
        />
      )}

      {/* Teclado en pantalla */}
      {showKeyboard && isManualMode && (
        <AppVirtualKeyboard
          value={search}
          onChange={setSearch}
          onClose={() => setShowKeyboard(false)}
          onEnter={() => {
            processSearchSubmit()
            setIsKeyboardMinimized(true)
          }}
          isMinimized={isKeyboardMinimized}
          onMinimizeChange={setIsKeyboardMinimized}
        />
      )}

      {/* TOAST NO ENCONTRADO */}
      {showNotFoundAlert && <NotFoundToast code={notFoundCode} />}

      {/* MODAL MONTO TARJETA DE REGALO */}
      {showGiftCardModal && (
        <GiftCardAmountModal
          amountStr={giftCardAmountStr}
          setAmountStr={setGiftCardAmountStr}
          onConfirm={handleGiftCardConfirm}
          onCancel={() => {
            setShowGiftCardModal(false);
            setPendingGiftCardProduct(null);
          }}
        />
      )}
    </div>
  )
}
