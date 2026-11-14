import { BadgeCheck, ClipboardList, LoaderCircle, PackageCheck, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { formatSar } from "@/lib/store-types";
import { trpc } from "@/lib/trpc";

type CustomerOrder = {
  orderCode: string;
  status: string;
  createdAt: Date | string;
  total: string;
  fulfillment: "delivery" | "pickup";
  items: Array<{ productName: string; size: string; quantity: number; lineTotal: string }>;
};

const statusLabels: Record<string, string> = {
  received: "جديد — بانتظار تأكيد المتجر",
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  out_for_delivery: "في الطريق إليكِ",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const customerCanCancel = (status: string) => status === "received" || status === "confirmed";

export default function ManageOrderPage() {
  const initialCode = new URLSearchParams(window.location.search).get("code") ?? "";
  const [orderCode, setOrderCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [formError, setFormError] = useState("");
  const lookup = trpc.store.orders.lookup.useMutation();
  const cancel = trpc.store.orders.cancel.useMutation();

  async function findOrder(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setOrder(null);
    try {
      const result = await lookup.mutateAsync({ orderCode, phone });
      if (!result) {
        setFormError("لم نعثر على طلب يطابق الرقم ورقم التواصل. تحققي من البيانات وأعيدي المحاولة.");
        return;
      }
      setOrder(result);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "تعذر العثور على الطلب الآن. حاولي لاحقًا.");
    }
  }

  async function cancelOrder() {
    if (!order || !customerCanCancel(order.status)) return;
    if (!window.confirm("هل تريدين إلغاء هذا الطلب نهائيًا؟ إذا كان مؤكدًا سيعود مخزونه إلى المتجر.")) return;
    setFormError("");
    try {
      await cancel.mutateAsync({ orderCode: order.orderCode, phone });
      setOrder({ ...order, status: "cancelled" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "تعذر إلغاء الطلب الآن. حاولي لاحقًا.");
    }
  }

  const canCancel = order ? customerCanCancel(order.status) : false;

  return (
    <div className="page-wrap customer-order-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><span>متابعة الطلب</span></div>
      <div className="catalog-head">
        <div><span className="eyebrow">خدمتكِ بعد الشراء</span><h1>متابعة الطلب</h1><p>أدخلي رقم الطلب ورقم التواصل نفسه المستخدم عند إتمام الشراء.</p></div>
        <PackageCheck className="cart-title-icon" size={29} />
      </div>

      <div className="customer-order-layout">
        <form className="customer-order-search" onSubmit={findOrder}>
          <div className="checkout-section-heading"><span>01</span><div><h2>بيانات الطلب</h2><p>لا يلزم إنشاء حساب.</p></div></div>
          <label className="field-label">رقم الطلب
            <input required minLength={8} maxLength={32} value={orderCode} onChange={(event) => setOrderCode(event.target.value.toUpperCase())} dir="ltr" autoComplete="off" placeholder="HA-…" />
          </label>
          <label className="field-label">رقم التواصل عند الطلب
            <input required minLength={8} maxLength={40} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" autoComplete="tel" placeholder="05xxxxxxxx" />
          </label>
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <button className="button button-dark button-full" type="submit" disabled={lookup.isPending}>
            {lookup.isPending ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
            {lookup.isPending ? "جارٍ البحث…" : "عرض حالة الطلب"}
          </button>
          <p className="customer-order-privacy"><ShieldCheck size={14} /> لن تظهر تفاصيل الطلب إلا عند تطابق رقم الطلب ورقم التواصل.</p>
        </form>

        <section className="customer-order-result" aria-live="polite">
          {!order ? (
            <div className="customer-order-empty"><ClipboardList size={24} /><strong>ستظهر حالة طلبكِ هنا</strong><span>احتفظي برقم الطلب الظاهر في رسالة تأكيد الشراء.</span></div>
          ) : (
            <article className="customer-order-card">
              <div className="customer-order-card-head">
                <div><span className="eyebrow">رقم الطلب</span><strong className="order-code" dir="ltr">{order.orderCode}</strong></div>
                <span className={`order-status-pill status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span>
              </div>
              <p className="customer-order-date">{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</p>
              <div className="customer-order-items">
                {order.items.map((item, index) => <div key={`${item.productName}-${item.size}-${index}`}><span>{item.productName} · {item.size} × {item.quantity}</span><strong>{formatSar(item.lineTotal)}</strong></div>)}
              </div>
              <div className="customer-order-total"><span>الإجمالي</span><strong>{formatSar(order.total)}</strong></div>
              {canCancel ? (
                <div className="customer-order-cancel-block">
                  <p>يمكنكِ إلغاء الطلب قبل أن يبدأ المتجر بتجهيزه.</p>
                  <button type="button" className="button button-cancel" onClick={cancelOrder} disabled={cancel.isPending}>
                    {cancel.isPending ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                    {cancel.isPending ? "جارٍ الإلغاء…" : "إلغاء هذا الطلب"}
                  </button>
                </div>
              ) : order.status === "cancelled" ? (
                <div className="customer-order-terminal"><BadgeCheck size={17} /><span>هذا الطلب ملغي بالفعل. لا يمكن إعادة فتحه.</span></div>
              ) : order.status === "completed" ? (
                <div className="customer-order-terminal"><BadgeCheck size={17} /><span>اكتمل هذا الطلب ولا يمكن إلغاؤه.</span></div>
              ) : (
                <div className="customer-order-terminal"><BadgeCheck size={17} /><span>بدأ تجهيز طلبكِ؛ لا يمكن إلغاؤه من الموقع. تواصلي مع المتجر للمساعدة.</span></div>
              )}
              {formError && <div className="form-error" role="alert">{formError}</div>}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
