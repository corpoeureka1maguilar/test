import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useProducts } from '@/features/catalog/hooks/useProducts'
import { useBarcodeScanner } from '@/features/catalog/hooks/useBarcodeScanner'
import { useProductFilters } from '@/features/catalog/hooks/useProductFilters'
import { useProductSearch } from '@/features/catalog/hooks/useProductSearch'
import { useProductNotFoundAlert } from '@/features/catalog/hooks/useProductNotFoundAlert'
import { useCatalogCart } from '@/features/catalog/hooks/useCatalogCart'
import { useCartTotal, useCartCount, useCartSubtotal, useCartTaxBreakdown } from '@/features/cart/stores/cart'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { HiddenScannerInput } from '@/features/catalog/components/HiddenScannerInput'
import { ManualSearchModal } from '@/features/catalog/components/ManualSearchModal'
import { CartSidebar } from '@/features/catalog/components/CartSidebar'
import { MobileCheckoutBar } from '@/features/catalog/components/MobileCheckoutBar'
import { NotFoundToast } from '@/features/catalog/components/NotFoundToast'
import { GiftCardAmountModal } from '@/features/catalog/components/GiftCardAmountModal'
import { BarcodeIcon, MagnifyingGlass } from '@phosphor-icons/react'

import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useConfigStore } from '@/shared/stores/config'
import { searchProducts } from '@/shared/lib/odooRepository'
import { matchBarcode } from '@/shared/lib/paymentUtils'
import type { KioskProduct } from '@/shared/types/types'

const MANUAL_GRID_LIMIT = 20

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

  // Búsqueda online contra el catálogo completo; cae al filtro local offline
  const { online, results, isSearching, searchFailed } = useProductSearch(debouncedSearch)
  const isOffline = useConfigStore((s) => s.isOffline)
  const pricelistId = useConfigStore((s) => s.pricelistId)

  let gridProducts = filtered
  let gridLoading = isLoading
  if (online && !searchFailed && results !== undefined) {
    gridProducts = (activeCategoryId === null
      ? results
      : results.filter(p => p.categId === activeCategoryId)
    ).slice(0, MANUAL_GRID_LIMIT)
  } else if (online && !searchFailed) {
    gridLoading = isSearching
  }

  const { showNotFoundAlert, notFoundCode, triggerNotFound } = useProductNotFoundAlert()

  const findExactMatch = (list: KioskProduct[], term: string) =>
    list.find(p => p.defaultCode?.toLowerCase() === term || matchBarcode(p.barcode, term))

  const processSearchSubmit = async () => {
    const originalQ = search.trim().toLowerCase()
    if (!originalQ) return
    setSearch('')

    let exactMatch = findExactMatch(products, originalQ)

    let cleanedQ = originalQ
    if (!exactMatch && originalQ.length % 2 === 0) {
      const half = originalQ.length / 2
      if (originalQ.slice(half) === originalQ.slice(0, half)) {
        cleanedQ = originalQ.slice(0, half)
        exactMatch = findExactMatch(products, cleanedQ)
      }
    }

    if (!exactMatch && !isOffline) {
      try {
        const remote = await searchProducts(cleanedQ, pricelistId)
        exactMatch = findExactMatch(remote, cleanedQ) ?? findExactMatch(remote, originalQ)
      } catch (err) {
        console.error('[ProductCatalog] Error buscando producto en el backend:', err)
      }
    }

    if (exactMatch) {
      handleAddItem(exactMatch)
    } else {
      triggerNotFound(originalQ)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void processSearchSubmit()
    }
  }

  const closeManualMode = () => {
    searchRef.current?.blur()
    setIsManualMode(false)
    setShowKeyboard(false)
  }

  const handleCheckout = () => {
    if (items.length === 0) return
    send({ type: 'CHECKOUT', cart: items })
    navigate('/lealtad')
  }

  return (
    <div
      className={`w-full max-w-6xl mx-auto self-center flex flex-col items-center justify-start h-full p-4 sm:p-6 overflow-y-auto box-border transition-all duration-200 ${showKeyboard && isManualMode ? (isKeyboardMinimized ? 'pb-20' : 'pb-80') : ''}`}
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

      {/* BOTÓN DE BÚSQUEDA Y CARRITO CENTRADO */}
      <div className="w-full flex flex-col gap-4 flex-1 min-h-0">
        <button
          type="button"
          className={`w-full bg-gray-100 text-gray-800 font-bold text-lg py-5 px-6 rounded-full border border-gray-200 hover:bg-gray-200 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer select-none ${isManualMode ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isManualMode) {
              closeManualMode();
            } else {
              setIsManualMode(true);
              setShowKeyboard(true);
            }
          }}
        >
          {isManualMode ? (
            <>
              <BarcodeIcon size={24} /> Escanear Productos
            </>
          ) : (
            <>
              <MagnifyingGlass size={24} /> Buscar Manualmente
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
            onClose={closeManualMode}
            categories={categories}
            activeCategoryId={activeCategoryId}
            setActiveCategoryId={setActiveCategoryId}
            isLoading={gridLoading}
            filtered={gridProducts}
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
            void processSearchSubmit()
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
