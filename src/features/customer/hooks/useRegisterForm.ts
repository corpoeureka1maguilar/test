import { useState, useEffect } from 'react'
import { z } from 'zod'
import { isValidVenezuelanPhone, isValidInternationalPhone } from '@/shared/lib/paymentUtils'
import { usePhoneInput } from '@/features/customer/hooks/usePhoneInput'

/** Country-aware phone refine: Venezuelan customers use the carrier rules, everyone else uses international `+` rules. */
export function makeRegisterSchema(isVenezuelan: boolean) {
  const isValidPhone = isVenezuelan ? isValidVenezuelanPhone : isValidInternationalPhone
  return z.object({
    name: z.string().trim().min(1, 'El nombre y apellido es requerido'),
    phone: z.string().trim().optional().refine(
      (val) => !val || isValidPhone(val),
      { message: 'El número de teléfono ingresado no es válido' }
    ),
    estado: z.string().trim()
      .min(1, 'El estado es requerido')
      .min(5, 'El estado debe tener al menos 5 caracteres'),
    street: z.string().trim()
      .min(1, 'La dirección es requerida')
      .min(5, 'La dirección debe tener al menos 5 caracteres'),
    email: z.string().trim().or(z.literal('')).optional().refine(
      (val) => !val || z.string().email().safeParse(val).success,
      { message: 'El correo electrónico ingresado no es válido' }
    )
  })
}

/** Back-compat export — existing consumers keep working (Venezuelan rules). */
export const registerSchema = makeRegisterSchema(true)

export type RegisterFormData = z.infer<typeof registerSchema>

interface UseRegisterFormProps {
  branchState: string
  vat: string
}

export function useRegisterForm({ branchState, vat }: UseRegisterFormProps) {
  const isVenezuelan = vat.startsWith('V-')

  const [form, setForm] = useState<Omit<RegisterFormData, 'phone'>>({
    name: '',
    estado: branchState,
    street: '',
    email: ''
  })

  const [activeField, setActiveField] = useState<keyof RegisterFormData | null>(null)

  const phoneInput = usePhoneInput(isVenezuelan)

  useEffect(() => {
    setForm({
      name: '',
      estado: branchState,
      street: '',
      email: ''
    })
  }, [vat, branchState])

  const set = (field: keyof Omit<RegisterFormData, 'phone'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setForm(f => ({ ...f, [field]: val }))
    }

  const handleKeyboardChange = (val: string, onStreetChange?: (val: string) => void) => {
    if (!activeField || activeField === 'phone') return
    setForm(f => ({ ...f, [activeField]: val }))
    if (activeField === 'street' && onStreetChange) {
      onStreetChange(val)
    }
  }

  const handleSuggestionSelect = (s: { street: string; estado: string }, clearSuggestions: () => void) => {
    setForm(f => ({ ...f, street: s.street, estado: f.estado || s.estado }))
    clearSuggestions()
    setActiveField(null)
  }

  const handleStateSelect = (stateName: string) => {
    setForm(f => ({ ...f, estado: stateName }))
    setActiveField(null)
  }

  const validate = () => {
    return makeRegisterSchema(isVenezuelan).safeParse({ ...form, phone: phoneInput.value })
  }

  return {
    form: { ...form, phone: phoneInput.value },
    activeField,
    setActiveField,
    set,
    handleKeyboardChange,
    handleSuggestionSelect,
    handleStateSelect,
    isVenezuelan,
    phoneInput,
    validate
  }
}
