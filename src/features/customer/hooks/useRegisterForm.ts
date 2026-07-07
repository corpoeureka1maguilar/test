import { useState, useEffect } from 'react'
import { z } from 'zod'
import { isValidVenezuelanPhone, formatPhone } from '@/shared/lib/paymentUtils'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre y apellido es requerido'),
  phone: z.string().trim().optional().refine(
    (val) => !val || isValidVenezuelanPhone(val),
    { message: 'El número de teléfono ingresado no es válido' }
  ),
  estado: z.string().trim(),
  street: z.string().trim().optional(),
  email: z.string().trim().or(z.literal('')).optional().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    { message: 'El correo electrónico ingresado no es válido' }
  )
})

export type RegisterFormData = z.infer<typeof registerSchema>

interface UseRegisterFormProps {
  branchState: string
  vat: string
}

export function useRegisterForm({ branchState, vat }: UseRegisterFormProps) {
  const [form, setForm] = useState<RegisterFormData>({
    name: '',
    phone: '',
    estado: branchState,
    street: '',
    email: ''
  })

  const [activeField, setActiveField] = useState<keyof RegisterFormData | null>(null)

  useEffect(() => {
    setForm({
      name: '',
      phone: '',
      estado: branchState,
      street: '',
      email: ''
    })
  }, [vat, branchState])

  const set = (field: keyof RegisterFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value
      if (field === 'phone') {
        val = formatPhone(val)
      }
      setForm(f => ({ ...f, [field]: val }))
    }

  const handleKeyboardChange = (val: string, onStreetChange?: (val: string) => void) => {
    if (!activeField) return
    let updatedVal = val
    if (activeField === 'phone') {
      updatedVal = formatPhone(val)
    }
    setForm(f => ({ ...f, [activeField]: updatedVal }))
    if (activeField === 'street' && onStreetChange) {
      onStreetChange(val)
    }
  }

  const handleSuggestionSelect = (s: { street: string; estado: string }, clearSuggestions: () => void) => {
    setForm(f => ({ ...f, street: s.street, estado: f.estado || s.estado }))
    clearSuggestions()
    setActiveField(null)
  }

  const handlePrefixSelect = (prefix: string) => {
    setForm(f => ({ ...f, phone: formatPhone(prefix) }))
  }

  const validate = () => {
    return registerSchema.safeParse(form)
  }

  return {
    form,
    activeField,
    setActiveField,
    set,
    handleKeyboardChange,
    handleSuggestionSelect,
    handlePrefixSelect,
    validate
  }
}
