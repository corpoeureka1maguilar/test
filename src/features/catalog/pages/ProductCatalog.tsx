import { useState, useMemo, useRef, useEffect } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useProducts } from '@/features/catalog/hooks/useProducts'
import { useCartStore, useCartTotal, useCartCount, useCartSubtotal, useCartTaxBreakdown } from '@/features/cart/stores/cart'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'
import { BarcodeIcon, MagnifyingGlass, Sparkle, ShoppingCart, Trash, WarningCircle } from '@phosphor-icons/react'

import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { matchBarcode, matchBarcodeIncludes } from '@/shared/lib/paymentUtils'
import styles from './ProductCatalog.module.css'

export function ProductCatalog() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()
  const { items, addItem, setQty, removeItem } = useCartStore()
  const total = useCartTotal()
  const subtotal = useCartSubtotal()
  const taxBreakdown = useCartTaxBreakdown()
  const count = useCartCount()
  const rate = useExchangeRateStore((s) => s.rate)
  const fixedProductIds = useConfigStore((s) => s.fixedProductIds) || []

  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  
  // New visual states for high-end barcode scanner flow
  const [isManualMode, setIsManualMode] = useState(false)
  const [lastScannedProduct, setLastScannedProduct] = useState<any | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  
  const [isBouncing, setIsBouncing] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [isKeyboardMinimized, setIsKeyboardMinimized] = useState(false)
  const [showNotFoundAlert, setShowNotFoundAlert] = useState(false)
  const [notFoundCode, setNotFoundCode] = useState('')

  // Auto-focus barcode input on mount and mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      searchRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [isManualMode])

  // Mantener enfocado el input para la lectura del scanner cuando no está en modo manual
  useEffect(() => {
    if (isManualMode) return
    const interval = setInterval(() => {
      if (document.activeElement !== searchRef.current) {
        searchRef.current?.focus()
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isManualMode])

  // Auto-dismiss not found alert after 2.5 seconds
  useEffect(() => {
    if (showNotFoundAlert) {
      const timer = setTimeout(() => {
        setShowNotFoundAlert(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [showNotFoundAlert, notFoundCode])

  // Refocus on barcode input for physical scanner input capture
  const handleWrapperClick = () => {
    searchRef.current?.focus()
  }

  const triggerCartAnimation = () => {
    setIsBouncing(true)
    setTimeout(() => setIsBouncing(false), 500)
  }

  const giftCardProductId = useConfigStore((s) => s.giftCardProductId)
  const addGiftCard = useCartStore((s) => s.addGiftCard)
  const pushToast = useUIStore((s) => s.pushToast)
  const [showGiftCardModal, setShowGiftCardModal] = useState(false)
  const [giftCardAmountStr, setGiftCardAmountStr] = useState('')
  const [pendingGiftCardProduct, setPendingGiftCardProduct] = useState<any | null>(null)

  const handleAddItem = (product: any) => {
    const isGiftCard = product.isGiftCard || product.id === giftCardProductId

    // Si ya hay una tarjeta de regalo en el carrito, bloquear la adición de otros productos
    if (items.some(i => i.isGiftCard)) {
      if (!isGiftCard) {
        pushToast('error', 'No podés combinar otros productos con la compra de una tarjeta de regalo.')
        return
      }
    }

    if (isGiftCard) {
      setPendingGiftCardProduct(product)
      setGiftCardAmountStr('')
      setShowGiftCardModal(true)
      return
    }

    addItem(product)
    setLastScannedProduct(product) // Store as last scanned for easy visual editing
    triggerCartAnimation()

    // Auto-agregar productos fijos si no están ya en el carrito.
    // Leer el estado fresco del store: el closure `items` es anterior al addItem
    // y duplicaría el fijo cuando el producto agregado ES el fijo.
    if (fixedProductIds.length > 0) {
      const currentItems = useCartStore.getState().items
      fixedProductIds.forEach((fixedId: number) => {
        const isAlreadyInCart = currentItems.some(item => item.productId === fixedId)
        if (!isAlreadyInCart) {
          const fixedProduct = products.find(p => p.id === fixedId)
          if (fixedProduct) {
            addItem(fixedProduct)
          }
        }
      })
    }
  }

  const handleGiftCardConfirm = () => {
    const amount = parseFloat(giftCardAmountStr)
    if (isNaN(amount) || amount <= 0) {
      pushToast('error', 'Ingresá un monto válido para la tarjeta de regalo.')
      return
    }
    if (pendingGiftCardProduct) {
      if (items.length > 0 && !items.every(i => i.productId === pendingGiftCardProduct.id)) {
        pushToast('info', 'Se vació el carrito para comprar la tarjeta de regalo.')
      }
      addGiftCard(pendingGiftCardProduct, amount)
      setLastScannedProduct({ ...pendingGiftCardProduct, price: amount, priceUsd: amount })
      triggerCartAnimation()
      setShowGiftCardModal(false)
      setPendingGiftCardProduct(null)
    }
  }

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
      setNotFoundCode(originalQ)
      setShowNotFoundAlert(true)
    }
    setSearch('') // Limpiar siempre el input para el próximo escaneo
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processSearchSubmit()
    }
  }

  const categories = useMemo(() => {
    const map = new Map<number, string>()
    products.forEach(p => map.set(p.categId, p.categName))
    return [...map.entries()]
      .map(([id, name]) => ({ id, name: name ?? '' }))
      .filter(c => c.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const filtered = useMemo(() => {
    let list = products
    if (activeCategoryId !== null) list = list.filter(p => p.categId === activeCategoryId)
    if (debouncedSearch.trim()) {
      const originalQ = debouncedSearch.trim().toLowerCase()

      // También limpiamos rebotes al buscar/filtrar
      let cleanedQ = originalQ
      if (originalQ.length % 2 === 0) {
        const half = originalQ.length / 2
        if (originalQ.slice(half) === originalQ.slice(0, half)) {
          cleanedQ = originalQ.slice(0, half)
        }
      }

      list = list.filter(p =>
        p.name.toLowerCase().includes(cleanedQ) ||
        p.defaultCode.toLowerCase().includes(cleanedQ) ||
        matchBarcodeIncludes(p.barcode, cleanedQ)
      )
    }
    return list
  }, [products, activeCategoryId, debouncedSearch])

  const getQty = (productId: number) =>
    items.find(i => i.productId === productId)?.qty ?? 0

  const handleCheckout = () => {
    if (items.length === 0) return
    send({ type: 'CHECKOUT', cart: items })
    navigate('/pago')
  }

  return (
    <div 
      className={`${styles.wrapper} ${styles.scanMode} ${showKeyboard && isManualMode ? (isKeyboardMinimized ? styles.keyboardMinimized : styles.keyboardOpen) : ''}`} 
      onClick={handleWrapperClick}
    >
      {/* INPUT OCULTO PARA EL SCANNER FÍSICO CUANDO EL MODAL ESTÁ CERRADO */}
      {!isManualMode && (
        <input
          ref={searchRef}
          type="text"
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', left: -9999 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          inputMode="none"
          autoComplete="off"
        />
      )}

      {/* SECCIÓN IZQUIERDA: ZONA DE OPERACIÓN (ESCANEO / BÚSQUEDA) */}
      <div className={styles.leftSection}>
        <div className={styles.scannerContainer}>
          {/* Zona del Lector de Código de Barras */}
          <div className={`${styles.scannerZone} ${lastScannedProduct ? styles.scannerZoneActive : ''}`}>
            <div className={styles.barcodeIcon}>
              <BarcodeIcon size={80} weight="thin" />
            </div>
            <div className={styles.scanInstruction}>
              Listo para escanear
            </div>
            <div className={styles.scanSubInstruction}>
              Pasa el código de barras de tu producto
            </div>
          </div>

          {/* Visualización Premium del Último Producto Escaneado */}
          {lastScannedProduct && (
            <div className={styles.lastScannedSection}>
              <div className={styles.lastScannedTitle}>
                <Sparkle size={18} weight="fill" style={{ color: 'var(--color-accent)', marginRight: '4px' }} />
                Último Producto Escaneado
              </div>
              <div className={styles.lastScannedCard}>
                <div className={styles.lastScannedHeader}>
                  <div className={styles.lastScannedInfo}>
                    <span className={styles.lastScannedCode}>
                      {lastScannedProduct.defaultCode || 'Sin código'}
                    </span>
                    <h3 className={styles.lastScannedName}>
                      {lastScannedProduct.name}
                      {lastScannedProduct.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
                    </h3>
                  </div>
                  <div className={styles.lastScannedPrice}>
                    {formatBs(lastScannedProduct.price)}
                    <span className={styles.amountUsd}>{formatUSD(lastScannedProduct.priceUsd)}</span>
                    <span className={styles.lastScannedUom}>
                      por {lastScannedProduct.uomName || 'unidad'}
                    </span>
                  </div>
                </div>
                
                {/* Control rápido de cantidad */}
                <div className={styles.lastScannedControls} onClick={(e) => e.stopPropagation()}>
                  <span className={styles.lastScannedControlsLabel}>
                    Cantidad:
                  </span>
                  <div className={styles.qtyControlGiant}>
                    <button
                      type="button"
                      onClick={() => {
                        const qty = getQty(lastScannedProduct.id)
                        if (qty > 1) {
                          setQty(lastScannedProduct.id, qty - 1)
                        } else {
                          removeItem(lastScannedProduct.id)
                          setLastScannedProduct(null)
                        }
                      }}
                    >
                      −
                    </button>
                    <span>{getQty(lastScannedProduct.id)}</span>
                    <button
                      type="button"
                      onClick={() => setQty(lastScannedProduct.id, getQty(lastScannedProduct.id) + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
        <div className={styles.modalOverlay} onClick={() => setIsManualMode(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Búsqueda Manual de Productos</h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsManualMode(false)}
              >
                Cerrar
              </button>
            </div>
            
            <div className={styles.modalSearchContainer}>
              <input
                ref={searchRef}
                type="text"
                className={styles.search}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setShowKeyboard(true);
                  setIsKeyboardMinimized(false);
                }}
                inputMode="none"
                placeholder="Escribí nombre o código de barras..."
                autoComplete="off"
              />
            </div>

            <div className={styles.manualSearchSection}>
              {/* Filtros de Categorías */}
              <div className={styles.categories}>
                <button
                  key="all"
                  type="button"
                  className={`${styles.catBtn} ${activeCategoryId === null ? styles.active : ''}`}
                  onClick={() => setActiveCategoryId(null)}
                >
                  Todos
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.catBtn} ${activeCategoryId === c.id ? styles.active : ''}`}
                    onClick={() => setActiveCategoryId(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Listado / Grid de Búsqueda Manual */}
              {isLoading ? (
                <p className={styles.loading}>Cargando catálogo...</p>
              ) : (
                <div className={styles.grid}>
                  {filtered.map(product => {
                    const qty = getQty(product.id)
                    return (
                      <div 
                        key={product.id} 
                        className={`${styles.card} ${qty > 0 ? 'animate-pop' : ''}`}
                        onClick={() => {
                          handleAddItem(product);
                        }}
                      >
                        <div>
                          {product.defaultCode && <span className={styles.code}>{product.defaultCode}</span>}
                          <h4 className={styles.name}>
                             {product.name}
                             {product.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
                          </h4>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <span className={styles.price}>{formatBs(product.price)}</span>
                          <span className={styles.amountUsd}>{formatUSD(product.priceUsd)}</span>
                          {qty === 0 ? (
                            <button
                              type="button"
                              className={`btn btn-primary ${styles.addBtn}`}
                              onClick={() => handleAddItem(product)}
                            >
                              + Agregar
                            </button>
                          ) : (
                            <div className={styles.qtyControl}>
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (qty > 1) {
                                    setQty(product.id, qty - 1)
                                  } else {
                                    removeItem(product.id)
                                    if (lastScannedProduct?.id === product.id) {
                                      setLastScannedProduct(null)
                                    }
                                  }
                                }}
                              >
                                −
                              </button>
                              <span>{qty}</span>
                              <button type="button" onClick={() => handleAddItem(product)}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {filtered.length === 0 && <p className={styles.empty}>No se encontraron productos</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        <div className={styles.cartSidebar}>
          <div className={styles.cartHeader}>
            <h2 className={styles.cartTitle}>Tu Compra</h2>
            <span className={styles.cartCountBadge}>{count} {count === 1 ? 'elemento' : 'elementos'}</span>
          </div>
        
          {/* Listado con Scroll de ítems */}
          <div className={styles.cartList}>
            {items.map(item => (
              <div key={item.productId} className={styles.cartItemCard}>
                <div className={styles.cartItemInfo}>
                  <div className={styles.cartItemName}>
                     {item.name}
                     {item.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
                  </div>
                  <div className={styles.cartItemMeta}>
                    {item.defaultCode && <span>{item.defaultCode}</span>}
                    <span>•</span>
                    <span className={styles.cartItemPrice}>{formatBs(item.price)} <span className={styles.amountUsd}>{formatUSD(item.priceUsd)}</span></span>
                  </div>
                </div>

                <div className={styles.cartItemActions} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.qtyControlMini}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.qty > 1) {
                          setQty(item.productId, item.qty - 1)
                        } else {
                          return 
                        }
                      }}
                    >
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>

                  <span className={styles.cartItemSubtotal}>
                    {formatBs(item.subtotal)}
                    <span className={styles.amountUsd}>{formatUSD(item.priceUsd * item.qty)}</span>
                  </span>

                  <button
                    type="button"
                    className={styles.removeBtnMini}
                    onClick={() => {
                      removeItem(item.productId)
                      if (lastScannedProduct?.id === item.productId) {
                        setLastScannedProduct(null)
                      }
                    }}
                    title="Eliminar"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className={styles.cartEmpty}>
                <ShoppingCart size={48} weight="light" style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
                <p>Tu carrito está vacío</p>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>
                  Escanéa códigos para agregar
                </span>
              </div>
            )}
          </div>

          {/* Desglose de totales */}
          <div className={styles.totalsSection}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>{formatBs(subtotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(subtotal / rate)}</span>}</span>
            </div>
            {taxBreakdown.map((tax) => (
              <div key={tax.rate} className={styles.totalRow}>
                <span>{tax.label}</span>
                <span>{formatBs(tax.amount)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(tax.amount / rate)}</span>}</span>
              </div>
            ))}
            <div className={styles.totalRowBig}>
              <span>Total</span>
              <span className={styles.totalAmount}>{formatBs(total)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}</span>
            </div>
          </div>

          {/* Acciones principales */}
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="btn btn-secondary cancelBtn" 
              onClick={() => { 
                send({ type: 'RESET' }); 
                navigate('/') 
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`btn btn-accent checkoutBtn ${isBouncing ? 'animate-pulse' : ''}`}
              onClick={handleCheckout}
              disabled={count === 0}
            >
              PAGAR AHORA
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Checkout Bar */}
      {items.length > 0 && (!showKeyboard || !isManualMode) && (
        <div className={styles.mobileCheckoutBar}>
          <div className={styles.mobileCheckoutInfo}>
            <span className={styles.mobileCheckoutCount}>
              {count} {count === 1 ? 'elemento' : 'elementos'}
            </span>
            <span className={styles.mobileCheckoutTotal}>
              Total: {formatBs(total)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleCheckout}
          >
            PAGAR AHORA
          </button>
        </div>
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
      {showNotFoundAlert && (
        <div className={styles.toastError}>
          <WarningCircle size={24} weight="fill" />
          <span>Producto no encontrado: "{notFoundCode}"</span>
        </div>
      )}

      {/* MODAL MONTO TARJETA DE REGALO */}
      {showGiftCardModal && (
        <div className={styles.giftCardModalOverlay} onClick={() => { setShowGiftCardModal(false); setPendingGiftCardProduct(null); }}>
          <div className={styles.giftCardModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.giftCardModalHeader}>
              <h3 className={styles.giftCardModalTitle}>Monto de la Tarjeta</h3>
              <span className={styles.giftCardModalSubtitle}>Ingrese el monto a recargar en USD</span>
            </div>
            <div className={styles.giftCardModalInputWrapper}>
              <span className={styles.giftCardModalLabel}>Monto ($)</span>
              <div className={styles.giftCardModalInput}>
                {giftCardAmountStr ? `$ ${giftCardAmountStr}` : <span style={{ opacity: 0.3 }}>$ 0.00</span>}
              </div>
            </div>
            <AppNumericKeyboard
              value={giftCardAmountStr}
              onChange={setGiftCardAmountStr}
              maxLength={5}
              onConfirm={handleGiftCardConfirm}
            />
            <div className={styles.giftCardModalActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowGiftCardModal(false); setPendingGiftCardProduct(null); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
