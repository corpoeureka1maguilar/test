import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartTotal } from '@/features/cart/stores/cart'
import { getPaymentLabel } from '@/shared/lib/paymentUtils'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useUIStore } from '@/shared/stores/ui'
import { usePaymentMethodGuard } from '@/features/payment/hooks/usePaymentMethodGuard'
import { usePaymentAmounts } from '@/features/payment/hooks/usePaymentAmounts'
import { useVposCheckout } from '@/features/payment/hooks/useVposCheckout'
import { useGiftCardPayment } from '@/features/payment/hooks/useGiftCardPayment'
import { usePaymentDetailsForm } from '@/features/payment/hooks/usePaymentDetailsForm'
import { VposPaymentView } from '@/features/payment/components/VposPaymentView'
import { GiftCardPaymentView } from '@/features/payment/components/GiftCardPaymentView'
import { PaymentAmountSummary } from '@/features/payment/components/PaymentAmountSummary'
import { PaymentDetailsForm } from '@/features/payment/components/PaymentDetailsForm'
import styles from './PaymentForm.module.css'

export function PaymentForm() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const total = useCartTotal()
  const globalRate = useExchangeRateStore((s) => s.rate)
  const pushToast = useUIStore((s) => s.pushToast)

  const method = context.selectedMethod

  usePaymentMethodGuard(method, navigate)

  const amounts = usePaymentAmounts(method, total, globalRate)
  const vpos = useVposCheckout({
    method,
    context,
    totalWithIgtfBs: amounts.totalWithIgtfBs,
    paymentAmount: amounts.paymentAmount,
    paymentIgtf: amounts.paymentIgtf,
    send,
    navigate,
    pushToast
  })
  const giftCard = useGiftCardPayment({ method, total, globalRate, send, navigate, pushToast })
  const detailsForm = usePaymentDetailsForm({ method, amounts, send, navigate, pushToast })

  if (!method) return null

  const handleBack = () => { send({ type: 'BACK' }); navigate('/pago') }

  if (method.withMerchant) {
    return (
      <VposPaymentView
        title={`${method.name || getPaymentLabel(method.paymentType)} (VPOS)`}
        vposStatus={vpos.vposStatus}
        iframeUrl={vpos.iframeUrl}
        onCancel={handleBack}
      />
    )
  }

  if (method.id === -999) {
    return (
      <GiftCardPaymentView
        total={total}
        globalRate={globalRate}
        orderTotalUSD={giftCard.orderTotalUSD}
        foundCard={giftCard.foundCard}
        hasSufficientBalance={giftCard.hasSufficientBalance}
        giftCardCode={giftCard.giftCardCode}
        onGiftCardCodeChange={giftCard.setGiftCardCode}
        searchingCard={giftCard.searchingCard}
        cardError={giftCard.cardError}
        showKeyboard={giftCard.showKeyboard}
        onShowKeyboardChange={giftCard.setShowKeyboard}
        onSearchCard={giftCard.handleSearchCard}
        onGiftCardSubmit={giftCard.handleGiftCardSubmit}
        onUseAnotherCard={giftCard.handleUseAnotherCard}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{method.name || getPaymentLabel(method.paymentType)}</h1>

      <PaymentAmountSummary
        isForeign={amounts.isForeign}
        hasRate={amounts.hasRate}
        total={total}
        globalRate={globalRate}
        igtfBs={amounts.igtfBs}
        igtfPercent={method.igtfPercent}
        currencySymbol={amounts.currencySymbol}
        igtfUSD={amounts.igtfUSD}
        totalWithIgtfBs={amounts.totalWithIgtfBs}
      />

      <PaymentDetailsForm
        fields={amounts.fields}
        bank={detailsForm.bank}
        onBankChange={detailsForm.setBank}
        phone={detailsForm.phone}
        onPhoneChange={detailsForm.setPhone}
        reference={detailsForm.reference}
        onReferenceChange={detailsForm.setReference}
        submitDisabled={amounts.isForeign && !amounts.hasRate}
        onSubmit={detailsForm.handleSubmit}
        onBack={handleBack}
      />
    </div>
  )
}
