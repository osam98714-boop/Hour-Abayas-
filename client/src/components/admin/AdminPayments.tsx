import { CreditCard, LockKeyhole } from "lucide-react";
import PaymentMethodsLocked from "@/components/store/PaymentMethodsLocked";

export default function AdminPayments() {
  return (
    <section className="admin-panel admin-payments-panel">
      <div className="admin-panel-heading">
        <div><span className="eyebrow">إعدادات الدفع</span><h2>وسائل الدفع الإلكتروني</h2></div>
        <span className="payment-coming-soon"><LockKeyhole size={12} /> غير مفعّلة</span>
      </div>
      <div className="admin-notice"><CreditCard size={18} /><p>هذه الخيارات للعرض والتخطيط فقط. لا تُفعّل أي وسيلة قبل ربط مزود دفع رسمي وإعداد المتطلبات اللازمة.</p></div>
      <PaymentMethodsLocked />
    </section>
  );
}
