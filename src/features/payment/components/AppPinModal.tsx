import { useState, useCallback, useRef, useEffect } from 'react'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { checkKioskAdmin, type KioskOperationRef } from '@/shared/lib/odooRepository'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'

interface Props {
  title?: string
  /**
   * Operación de x.pos.audit.operation a validar contra Odoo. Con conexión
   * activa el PIN se chequea contra el admin_password del cajero admin de la
   * sucursal (con permiso por operación y auditoría en x.pos.audit). Sin
   * operationRef, o sin conexión, se valida contra el PIN local de la terminal.
   */
  operationRef?: KioskOperationRef
  auditMessage?: string | undefined
  onConfirmed: () => void
  onCancel: () => void
}

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 30_000

export function AppPinModal({ title = 'Acceso de administrador', operationRef, auditMessage, onConfirmed, onCancel }: Props) {
  const verifyPin = useConfigStore((s) => s.verifyPin)
  const scannerRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [noAllowed, setNoAllowed] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [shake, setShake] = useState(false)

  // lockedUntil se limpia a null desde el useEffect de abajo en cuanto vence
  // (chequeo cada 1s); no comparar contra Date.now() acá evita una llamada
  // impura durante el render (react-hooks/purity)
  const isLocked = lockedUntil !== null

  useEffect(() => {
    if (!lockedUntil) return

    const updateRemaining = () => {
      const rem = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (rem <= 0) {
        setLockedUntil(null)
        setRemaining(0)
      } else {
        setRemaining(rem)
      }
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  useEffect(() => {
    scannerRef.current?.focus()
  }, [])

  const verifyAdmin = useCallback(async (value: string): Promise<{ ok: boolean; noAllowed?: boolean }> => {
    const { isConnectionReady, branchId } = useConfigStore.getState()
    if (operationRef && isConnectionReady && branchId) {
      try {
        const res = await checkKioskAdmin(
          value,
          operationRef,
          branchId,
          useSessionStore.getState().sessionId,
          auditMessage
        )
        return { ok: res.ok, noAllowed: res.error === 'no_allowed' }
      } catch (err) {
        // Sin backend no hay validación de permisos posible: caemos al PIN
        // local para no dejar la terminal bloqueada (p. ej. justamente para
        // entrar a reparar la conexión con Odoo)
        console.error('[AppPinModal] Error validando contra Odoo, fallback a PIN local:', err)
      }
    }
    return { ok: await verifyPin(value) }
  }, [operationRef, auditMessage, verifyPin])

  const attempt = useCallback(async (value: string) => {
    if (isLocked || value.length === 0) return

    const res = await verifyAdmin(value)
    if (res.ok) {
      onConfirmed()
      return
    }

    setNoAllowed(Boolean(res.noAllowed))
    const next = attempts + 1
    setAttempts(next)
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 400)

    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_MS)
      setAttempts(0)
    }
  }, [attempts, isLocked, verifyAdmin, onConfirmed])

  const handleConfirm = useCallback(() => {
    attempt(pin).catch((err) => {
      console.error('[AppPinModal] Error validando PIN:', err)
    })
  }, [attempt, pin])

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const raw = e.currentTarget.value.trim()
    e.currentTarget.value = ''
    if (raw.length > 0) {
      setPin(raw)
      attempt(raw).catch((err) => {
        console.error('[AppPinModal] Error validando PIN:', err)
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60"
      onClick={() => scannerRef.current?.focus()}
    >
      <input
        ref={scannerRef}
        type="text"
        aria-hidden="true"
        className="absolute pointer-events-none opacity-0"
        onKeyDown={handleScannerKeyDown}
        readOnly={isLocked}
      />
      <div
        className={`flex w-[min(480px,90vw)] flex-col items-center gap-6 rounded-[20px] bg-white p-10 ${shake ? 'animate-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-center text-2xl font-bold">{title}</h2>

        {isLocked ? (
          <p className="m-0 text-center text-[1.1rem] text-[#666]">Bloqueado. Intentá de nuevo en {remaining}s</p>
        ) : (
          <>
            {attempts > 0 && (
              <p className="m-0 text-center text-base text-danger">
                {noAllowed ? 'No tenés permiso para esta operación.' : 'PIN incorrecto.'}{' '}
                {MAX_ATTEMPTS - attempts} intento(s) restante(s)
              </p>
            )}
            <AppNumericKeyboard value={pin} onChange={setPin} maxLength={6} masked onConfirm={handleConfirm} />
            <div className="flex w-full flex-col gap-3">
              <button className="btn btn-primary" onClick={handleConfirm} disabled={pin.length === 0}>
                Confirmar
              </button>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
