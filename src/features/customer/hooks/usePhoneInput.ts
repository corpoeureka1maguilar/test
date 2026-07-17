import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import {
  isValidVenezuelanPhone,
  formatPhone,
  isValidInternationalPhone,
  formatInternationalPhone
} from '@/shared/lib/paymentUtils'

const VE_PREFIXES = ['0412', '0414', '0424', '0416', '0426', '0422']

export function usePhoneInput(isVenezuelan: boolean) {
  // `raw` is always a plain digit string — the single source of truth. The
  // displayed `value` is derived from it on every render.
  const [raw, setRaw] = useState('')

  // Lets a V- (Venezuelan document) customer opt into the international
  // format when their actual phone isn't a local carrier number. Only
  // meaningful while `isVenezuelan` is true — foreign-document customers are
  // always international already.
  const [manualInternational, setManualInternational] = useState(false)

  const usesVenezuelanFormat = isVenezuelan && !manualInternational

  // Switching nationality mode must not carry over the previous mode's value.
  useEffect(() => {
    setRaw('')
    setManualInternational(false)
  }, [isVenezuelan])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value.replace(/\D/g, ''))
  }

  // The global AppVirtualKeyboard singleton (mounted in RootLayout) caches the
  // focused input's value and only refreshes that cache on native `input`/focus
  // events — never on React state changes. Quick-select prefixes mutate state
  // directly (no native event), so its cache goes stale and the next on-screen
  // keypress overwrites the prefix. Re-dispatching a native `input` event on the
  // still-focused element (prefix buttons use onMouseDown+preventDefault, so
  // focus never leaves the phone input) forces the cache to resync. This is the
  // fix for the corruption/reset bug.
  const resyncGlobalKeyboard = () => {
    requestAnimationFrame(() => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement) {
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
  }

  const onPrefixSelect = (prefix: string) => {
    setRaw(prefix.replace(/\D/g, ''))
    resyncGlobalKeyboard()
  }

  const switchToInternational = () => {
    setRaw('')
    setManualInternational(true)
  }

  const switchToVenezuelan = () => {
    setRaw('')
    setManualInternational(false)
  }

  const value = usesVenezuelanFormat ? formatPhone(raw) : formatInternationalPhone(raw)
  const isValid = usesVenezuelanFormat ? isValidVenezuelanPhone(value) : isValidInternationalPhone(value)
  const prefixes = usesVenezuelanFormat ? VE_PREFIXES : []

  return {
    value,
    onChange,
    onPrefixSelect,
    isValid,
    prefixes,
    isInternational: !usesVenezuelanFormat,
    canSwitchToVenezuelan: isVenezuelan,
    switchToInternational,
    switchToVenezuelan
  }
}
