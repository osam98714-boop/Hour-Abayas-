import { ArrowRight, Check, MapPin, PackageCheck, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import SiteMessage from "@/components/store/SiteMessage";
import GoogleLocationPicker from "@/components/store/GoogleLocationPicker";
import PaymentMethodsLocked from "@/components/store/PaymentMethodsLocked";
import { useCart } from "@/contexts/CartContext";
import { formatSar } from "@/lib/store-types";
import { trpc } from "@/lib/trpc";

type Coordinates = { lat: number; lng: number };

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const statusQuery = trpc.store.status.useQuery(undefined, { retry: false });
  const createOrder = trpc.store.orders.create.useMutation();
  const googleMapsBrowserKey = window.__MANUS_CONFIG__?.googleMapsBrowserKey ?? "";
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [receipt, setReceipt] = useState<{ orderCode: string; total: string } | null>(null);
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (fulfillment === "delivery" && googleMapsBrowserKey && !manualLocation && !coordinates) {
      setFormError("حددي نقطة التوصيل على الخريطة قبل تأكيد الطلب.");
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        customerName,
        phone,
        address: fulfillment === "delivery" ? address : "",
        latitude: fulfillment === "delivery" ? coordinates?.lat ?? null : null,
        longitude: fulfillment === "delivery" ? coordinates?.lng ?? null : null,
        manualLocation: fulfillment === "delivery" && manualLocation,
        fulfillment,
        items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      });
      setReceipt(result);
      clear();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "تعذر حفظ الطلب. حاولي مجددًا.");
    }
  }

  if (receipt) return <div className="page-wrap"><section className="order-success"><div className="success-mark"><Check size={28} /></div><span className="eyebrow">وصل طلبكِ إلى حور</span><h1>شكرًا لثقتكِ</h1><p>رقم الطلب <strong dir="ltr">{receipt.orderCode}</strong></p><div className="success-total"><span>الإجمالي التقديري</span><strong>{formatSar(receipt.total)}</strong></div><p className="success-note">طلبكِ بانتظار تأكيد المتجر. لا يُحجز المخزون حتى يؤكد الفريق توفر المقاس ورسوم التوصيل بحسب موقعكِ. الدفع الإلكتروني غير متاح حاليًا، ولن يتم تحويلكِ إلى واتساب.</p><Link href="/" className="button button-dark">العودة إلى المتجر</Link></section></div>;
  if (items.length === 0) return <div className="page-wrap"><SiteMessage title="لا توجد منتجات لإتمام الطلب" message="أضيفي اختياراتكِ إلى السلة أولًا، ثم عودي لإتمام الطلب كضيفة." action={<Link href="/women" className="button button-dark">اكتشفي التشكيلة</Link>} /></div>;
  if (statusQuery.isLoading) return <div className="page-wrap page-loading">جارٍ التحقق من جاهزية إتمام الطلب…</div>;
  if (!statusQuery.data?.databaseConfigured || !statusQuery.data.orderProtectionConfigured) return <div className="page-wrap"><SiteMessage title="إتمام الطلب قيد الإعداد" message={!statusQuery.data?.databaseConfigured ? "لم تُربط قاعدة بيانات المتجر بعد. لا نحتفظ بطلبكِ قبل تفعيل Neon وإعداد قاعدة البيانات." : "لم يكتمل إعداد الحماية اللازمة لاستقبال الطلبات بعد. لن يُحفظ طلبكِ حتى يكتمل إعداد المتجر."} action={<Link href="/cart" className="button button-dark">العودة إلى السلة</Link>} /></div>;

  return (
    <div className="page-wrap checkout-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href="/cart">السلة</Link><span>/</span><span>إتمام الطلب</span></div>
      <div className="catalog-head"><div><span className="eyebrow">خطوة أخيرة</span><h1>إتمام الطلب</h1><p>لا يلزم إنشاء حساب — بياناتكِ تحفظ لإدارة هذا الطلب فقط.</p></div><PackageCheck className="cart-title-icon" size={29} /></div>
      <form className="checkout-layout" onSubmit={submit}>
        <section className="checkout-form-card">
          <div className="checkout-section-heading"><span>01</span><div><h2>بيانات التواصل</h2><p>أدخلي الاسم ورقم التواصل لمتابعة الطلب.</p></div></div>
          <div className="form-grid">
            <label className="field-label">الاسم الكامل<input required minLength={2} maxLength={140} value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" placeholder="الاسم كما تحبين أن نناديكِ" /></label>
            <label className="field-label">رقم التواصل<input required minLength={8} maxLength={40} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" dir="ltr" placeholder="05xxxxxxxx" /></label>
          </div>
          <div className="checkout-section-heading"><span>02</span><div><h2>طريقة الاستلام</h2><p>الخدمة متاحة داخل مكة المكرمة.</p></div></div>
          <div className="fulfillment-options">
            <label className={fulfillment === "delivery" ? "fulfillment-option selected" : "fulfillment-option"}><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} /><Truck size={19} /><span><strong>التوصيل داخل مكة</strong><small>يبدأ من 15 ريالًا، وقد يزيد حسب بُعد الموقع</small></span></label>
            <label className={fulfillment === "pickup" ? "fulfillment-option selected" : "fulfillment-option"}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === "pickup"} onChange={() => setFulfillment("pickup")} /><MapPin size={19} /><span><strong>استلام مجاني من المنزل</strong><small>بلا رسوم توصيل</small></span></label>
          </div>
          {fulfillment === "delivery" && <>
            {googleMapsBrowserKey && !manualLocation ? <GoogleLocationPicker apiKey={googleMapsBrowserKey} coordinates={coordinates} onChange={setCoordinates} onManualFallback={() => { setManualLocation(true); setCoordinates(null); }} /> : googleMapsBrowserKey ? <div className="location-map-unavailable location-manual-fallback"><MapPin size={18} /><div><strong>سيُرسل الطلب بعنوان يدوي</strong><small>اكتبي الحي والشارع وأقرب معلم. سيتحقق المتجر من الموقع قبل تأكيد التوصيل.</small></div><button type="button" className="button button-quiet" onClick={() => setManualLocation(false)}>اختيار نقطة على الخريطة</button></div> : <div className="location-map-unavailable"><MapPin size={18} /><div><strong>خريطة تحديد الموقع غير مهيأة بعد</strong><small>يمكنكِ كتابة عنوانكِ الآن. ستظهر الخريطة بعد إضافة مفتاح Google Maps إلى Vercel وإعادة النشر.</small></div></div>}
            <label className="field-label address-field">عنوان التوصيل داخل مكة<textarea required minLength={5} maxLength={1000} rows={3} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" placeholder="الحي، الشارع، رقم المبنى أو أقرب معلم — مثال: حي كدي، بالقرب من…" /></label>
          </>}
          <PaymentMethodsLocked compact />
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <button type="submit" className="button button-gold button-full submit-order" disabled={createOrder.isPending}>{createOrder.isPending ? "جارٍ حفظ الطلب…" : "تأكيد الطلب"}<ArrowRight size={16} /></button>
          <p className="privacy-hint">يُحفظ الطلب في لوحة إدارة المتجر. لا تُطلب بيانات بطاقة ولا يُحصّل دفع إلكتروني الآن.</p>
        </section>
        <aside className="order-summary-card checkout-summary"><span className="eyebrow">مراجعة اختياراتكِ</span><h2>ملخص الطلب</h2><div className="checkout-items">{items.map((item) => <div className="checkout-line" key={item.variantId}><span className="checkout-qty">{item.quantity}</span><div><strong>{item.productName}</strong><small>المقاس {item.size}</small></div><b>{formatSar(Number(item.unitPrice) * item.quantity)}</b></div>)}</div><div className="summary-line"><span>قيمة المنتجات</span><strong>{formatSar(subtotal)}</strong></div><div className="summary-line"><span>رسوم الاستلام</span><strong>{fulfillment === "pickup" ? "مجانًا" : "تبدأ من 15 ر.س."}</strong></div><div className="summary-total"><span>المجموع التقديري</span><strong>{formatSar(subtotal + (fulfillment === "delivery" ? 15 : 0))}</strong></div><p>قد تزيد رسوم التوصيل بحسب بُعد الموقع. ستُحدّد بدقة قبل تأكيد التسليم.</p></aside>
      </form>
    </div>
  );
}
