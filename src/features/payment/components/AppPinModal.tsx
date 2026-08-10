import { useState, useCallback, useRef, useEffect } from 'react'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { checkKioskAdmin, type KioskOperationRef } from '@/shared/lib/odooRepository'
import { verifyAdminOffline } from '@/shared/lib/adminSnapshot'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'

interface Props {
  title?: string
  /**
   * Operación de x.pos.audit.operation a validar. Obligatoria: la terminal no
   * tiene PIN propio, así que sin operación no hay nada contra qué validar.
   *
   * Con conexión el PIN se chequea contra el admin_password del cajero admin de
   * la sucursal vía `action_check_kiosk_admin` (permiso por operación +
   * auditoría en x.pos.audit). Sin conexión se valida contra el snapshot local
   * de esos mismos admins, que vence a los 30 min (ver adminSnapshot.ts).
   */
  operationRef: KioskOperationRef
  auditMessage?: string | undefined
  onConfirmed: () => void
  onCancel: () => void
}

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 30_000

type PinError = 'wrong' | 'no_allowed' | 'snapshot_unavailable'

const ERROR_MESSAGE: Record<PinError, string> = {
  wrong: 'PIN incorrecto.',
  no_allowed: 'No tenés permiso para esta operación.',
  snapshot_unavailable: 'Sin conexión con Odoo y sin validación local vigente. Restablecé la conexión.'
}

export function AppPinModal({ title = 'Acceso de administrador', operationRef, auditMessage, onConfirmed, onCancel }: Props) {
  const scannerRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<PinError>('wrong')
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

  const verifyAdmin = useCallback(async (value: string): Promise<{ ok: boolean; error?: PinError }> => {
    const { isConnectionReady, branchId } = useConfigStore.getState()
    if (isConnectionReady && branchId) {
      try {
        const res = await checkKioskAdmin(
          value,
          operationRef,
          branchId,
          useSessionStore.getState().sessionId,
          auditMessage
        )
        return { ok: res.ok, error: res.error === 'no_allowed' ? 'no_allowed' : 'wrong' }
      } catch (err) {
        // Odoo no responde: se cae al snapshot local, que valida contra los
        // MISMOS admin_password y los mismos permisos por operación. No hay PIN
        // de terminal al que caer — si el snapshot venció, no se aprueba nada.
        console.error('[AppPinModal] Error validando contra Odoo, fallback al snapshot local:', err)
      }
    }

    const offline = await verifyAdminOffline(value, operationRef, auditMessage)
    if (offline.ok) return { ok: true }
    return { ok: false, error: offline.error === 'admin_not_found' ? 'wrong' : offline.error ?? 'wrong' }
  }, [operationRef, auditMessage])

  const attempt = useCallback(async (value: string) => {
    if (isLocked || value.length === 0) return

    const res = await verifyAdmin(value)
    if (res.ok) {
      onConfirmed()
      return
    }

    const reason = res.error ?? 'wrong'
    setError(reason)
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 400)

    // Snapshot vencido no es un PIN equivocado: no hay nada que el supervisor
    // pueda tipear bien, así que bloquear por reintentos solo estorba
    if (reason === 'snapshot_unavailable') {
      setAttempts(0)
      return
    }

    const next = attempts + 1
    setAttempts(next)
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
            {error === 'snapshot_unavailable' ? (
              <p className="m-0 text-center text-base text-danger">{ERROR_MESSAGE.snapshot_unavailable}</p>
            ) : attempts > 0 && (
              <p className="m-0 text-center text-base text-danger">
                {ERROR_MESSAGE[error]}{' '}
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
