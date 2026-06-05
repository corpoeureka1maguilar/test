import { useState, useMemo, useRef, useEffect } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useProducts } from '@/features/catalog/hooks/useProducts'
import { useCartStore, useCartTotal, useCartCount } from '@/features/cart/stores/cart'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'

import styles from './ProductCatalog.module.css'

export function ProductCatalog() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()
  const { items, addItem, setQty, removeItem } = useCartStore()
  const total = useCartTotal()
  const count = useCartCount()

  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  
  // New visual states for high-end barcode scanner flow
  const [isManualMode, setIsManualMode] = useState(false)
  const [lastScannedProduct, setLastScannedProduct] = useState<any | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  
  const [isBouncing, setIsBouncing] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)

  // Auto-focus barcode input on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Refocus on barcode input for physical scanner input capture
  const handleWrapperClick = () => {
    searchRef.current?.focus()
  }

  const triggerCartAnimation = () => {
    setIsBouncing(true)
    setTimeout(() => setIsBouncing(false), 500)
  }

  const handleAddItem = (product: any) => {
    addItem(product)
    setLastScannedProduct(product) // Store as last scanned for easy visual editing
    triggerCartAnimation()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = search.trim().toLowerCase()
      if (!q) return

      // Find exact match by default code (ref) or barcode Technical Field
      const exactMatch = products.find(p =>
        p.defaultCode?.toLowerCase() === q ||
        p.barcode?.toLowerCase() === q
      )

      if (exactMatch) {
        handleAddItem(exactMatch)
        setSearch('') // Clear search input for next scan
      }
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
      const q = debouncedSearch.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.defaultCode.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      )
    }
    return list
  }, [products, activeCategoryId, debouncedSearch])

  const getQty = (productId: number) =>
    items.find(i => i.productId === productId)?.qty ?? 0

  const handleCheckout = () => {
    if (items.length === 0) return
    send({ type: 'CHECKOUT', cart: items })
    navigate('/carrito')
  }

  return (
    <div 
      className={`${styles.wrapper} ${showKeyboard && isManualMode ? styles.keyboardOpen : ''}`} 
      onClick={handleWrapperClick}
    >
      {/* SECCIÓN IZQUIERDA: ZONA DE OPERACIÓN (ESCANEO / BÚSQUEDA) */}
      <div className={styles.leftSection}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.greeting}>
            Hola, <strong>{context.customer?.name ?? 'cliente'}</strong>
          </div>
          <button
            type="button"
            className={`${styles.manualToggleBtn} ${isManualMode ? styles.active : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              const newMode = !isManualMode;
              setIsManualMode(newMode);
              setShowKeyboard(newMode);
              if (newMode) {
                setTimeout(() => searchRef.current?.focus(), 50);
              }
            }}
          >
            {isManualMode ? '🖨️ Escanear Productos' : '🔍 Buscar Manualmente'}
          </button>
        </div>

        {/* INPUT DE BÚSQUEDA - Siempre activo para la pistola física */}
        <div 
          style={{ 
            position: 'absolute', 
            opacity: isManualMode ? 1 : 0, 
            pointerEvents: isManualMode ? 'auto' : 'none', 
            top: isManualMode ? '70px' : '-1000px', 
            width: '100%', 
            zIndex: 10,
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={searchRef}
            type="text"
            className={styles.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (isManualMode) setShowKeyboard(true);
            }}
            inputMode="none"
            placeholder="Escribí nombre o código de barras..."
            autoComplete="off"
          />
        </div>

        {/* MODO ESCANEO (Por Defecto) */}
        {!isManualMode ? (
          <div className={styles.scannerContainer}>
            {/* Zona del Lector de Código de Barras */}
            <div className={`${styles.scannerZone} ${lastScannedProduct ? styles.scannerZoneActive : ''}`}>
              <div className={styles.barcodeIcon}>📊</div>
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
                  ✨ Último Producto Escaneado
                </div>
                <div className={styles.lastScannedCard}>
                  <div className={styles.lastScannedHeader}>
                    <div className={styles.lastScannedInfo}>
                      <span className={styles.lastScannedCode}>
                        {lastScannedProduct.defaultCode || 'Sin código'}
                      </span>
                      <h3 className={styles.lastScannedName}>
                        {lastScannedProduct.name}
                      </h3>
                    </div>
                    <div className={styles.lastScannedPrice}>
                      Bs. {lastScannedProduct.price.toFixed(2)}
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
        ) : (
          /* MODO BÚSQUEDA MANUAL */
          <div className={styles.manualSearchSection} style={{ marginTop: '5.5rem' }}>
            {/* Filtros de Categorías */}
            <div className={styles.categories} onClick={(e) => e.stopPropagation()}>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddItem(product);
                      }}
                    >
                      <div>
                        {product.defaultCode && <span className={styles.code}>{product.defaultCode}</span>}
                        <h4 className={styles.name}>{product.name}</h4>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <span className={styles.price}>Bs. {product.price.toFixed(2)}</span>
                        <div className={styles.uom} style={{ marginBottom: '0.5rem' }}>
                          {product.uomName}
                        </div>
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
        )}
      </div>

      {/* SECCIÓN DERECHA: CARRITO LATERAL INTEGRADO EN CALIENTE */}
      <div className={styles.rightSection}>
        <div className={styles.cartSidebar}>
          <div className={styles.cartHeader}>
            <h2 className={styles.cartTitle}>Tu Compra</h2>
            <span className={styles.cartCountBadge}>{count} {count === 1 ? 'ítem' : 'ítems'}</span>
          </div>

          {/* Listado con Scroll de ítems */}
          <div className={styles.cartList}>
            {items.map(item => (
              <div key={item.productId} className={styles.cartItemCard}>
                <div className={styles.cartItemInfo}>
                  <div className={styles.cartItemName}>{item.name}</div>
                  <div className={styles.cartItemMeta}>
                    {item.defaultCode && <span>{item.defaultCode}</span>}
                    <span>•</span>
                    <span className={styles.cartItemPrice}>Bs. {item.price.toFixed(2)}</span>
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
                          removeItem(item.productId)
                          if (lastScannedProduct?.id === item.productId) {
                            setLastScannedProduct(null)
                          }
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
                    Bs. {item.subtotal.toFixed(2)}
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
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className={styles.cartEmpty}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛒</div>
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
              <span>Bs. {total.toFixed(2)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Impuestos estimados</span>
              <span>Bs. 0.00</span>
            </div>
            <div className={styles.totalRowBig}>
              <span>Total</span>
              <span className={styles.totalAmount}>Bs. {total.toFixed(2)}</span>
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

      {/* Teclado en pantalla */}
      {showKeyboard && isManualMode && (
        <AppVirtualKeyboard
          value={search}
          onChange={setSearch}
          onClose={() => setShowKeyboard(false)}
          onEnter={() => setShowKeyboard(false)}
        />
      )}
    </div>
  )
}
