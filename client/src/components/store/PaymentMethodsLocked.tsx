import { CreditCard, LockKeyhole } from "lucide-react";

const methods = ["مدى", "Visa و Mastercard", "Apple Pay", "STC Pay"];

export default function PaymentMethodsLocked({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "payment-methods-locked compact" : "payment-methods-locked"} aria-disabled="true" aria-labelledby="payment-methods-title">
      <div className="payment-methods-heading">
        <span className="payment-lock"><LockKeyhole size={16} /></span>
        <div><strong id="payment-methods-title">الدفع الإلكتروني</strong><small>قريبًا — لا يتم تحصيل أي مبلغ عبر الموقع الآن.</small></div>
        <span className="payment-coming-soon">مقفل</span>
      </div>
      <div className="payment-method-options">
        {methods.map((method) => <span key={method} className="payment-method-option"><CreditCard size={15} />{method}<LockKeyhole size={11} /></span>)}
      </div>
      {!compact && <p className="payment-disclaimer">أكملي الطلب دون دفع إلكتروني؛ سيتواصل المتجر لتأكيد الطلب ورسوم التوصيل.</p>}
    </section>
  );
}
