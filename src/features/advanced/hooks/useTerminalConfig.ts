import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import type { AdvancedTab } from '../components/AdvancedTabs'
import type { PendingAdminAction } from './useAdminPinAction'

export interface TerminalConfigForm {
  odooUrl: string
  odooDb: string
  serviceUser: string
  servicePassword: string
  printerUrl: string
  printerModel: string
  adminPin: string
}

export function useTerminalConfig(activeTab: AdvancedTab, requestAdminAction: (action: PendingAdminAction) => void) {
  const queryClient = useQueryClient()
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()
  const [isTerminalUnlocked, setIsTerminalUnlocked] = useState(false)

  // Formulario para la parametrización de la terminal
  const [form, setForm] = useState<TerminalConfigForm>({
    odooUrl: config.odooUrl,
    odooDb: config.odooDb,
    serviceUser: config.serviceUser,
    servicePassword: config.servicePassword,
    printerUrl: config.printerUrl,
    printerModel: config.printerModel,
    adminPin: ''
  })

  // La pestaña Terminal es de solo lectura por defecto: hay que confirmar el
  // PIN de administrador para desbloquear la edición. Se vuelve a bloquear
  // al salir de la pestaña para no dejarla editable si alguien la abandona.
  // Ajustado durante el render para que el bloqueo ocurra en el mismo render
  // que el cambio de pestaña, sin un frame intermedio con la edición abierta.
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab)
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab)
    if (activeTab !== 'terminal') {
      setIsTerminalUnlocked(false)
      setForm((f) => ({ ...f, adminPin: '' }))
    }
  }

  const requestUnlockTerminal = () => {
    requestAdminAction({
      title: 'Confirma para modificar la configuración',
      operationRef: KIOSK_OPERATIONS.terminalConfig,
      run: () => setIsTerminalUnlocked(true)
    })
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.adminPin.length < 4) {
      pushToast('error', 'El PIN de administrador debe tener al menos 4 dígitos')
      return
    }
    setLoading(true)
    try {
      await config.saveConfig(form)
      pushToast('success', 'Configuración de la terminal guardada y sincronizada')
      setForm((f) => ({ ...f, adminPin: '' })) // Limpiar el pin por seguridad
      setIsTerminalUnlocked(false) // Vuelve a modo solo lectura tras guardar
    } catch (err) {
      pushToast('error', `Error al guardar configuración: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const setFormField = (field: keyof TerminalConfigForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleReloadCache = async () => {
    setLoading(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['products'] }),
        queryClient.refetchQueries({ queryKey: ['payment-methods'] })
      ])
      pushToast('success', 'Caché recargado con éxito')
    } catch (err) {
      pushToast('error', `Error al recargar caché: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return {
    form,
    setFormField,
    isTerminalUnlocked,
    requestUnlockTerminal,
    handleSaveConfig,
    handleReloadCache
  }
}
