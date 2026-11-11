import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "wouter";
import SiteMessage from "@/components/store/SiteMessage";
import { useCart } from "@/contexts/CartContext";
import { formatSar } from "@/lib/store-types";

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  if (items.length === 0) return <div className="page-wrap"><SiteMessage title="سلتكِ بانتظار اختياراتكِ" message="لم تُضيفي أي قطعة بعد. اكتشفي تشكيلات حور الحقيقية واختاري مقاسكِ." action={<Link href="/women" className="button button-dark">تصفحي التشكيلة</Link>} /></div>;

  return (
    <div className="page-wrap cart-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><span>سلة المشتريات</span></div>
      <div className="catalog-head"><div><span className="eyebrow">اختياراتكِ</span><h1>سلة المشتريات</h1><p>راجعي القطع والمقاسات قبل إرسال طلبكِ.</p></div><ShoppingBag className="cart-title-icon" size={26} /></div>
      <div className="cart-layout">
        <section className="cart-items-list" aria-label="المنتجات في السلة">
          {items.map((item) => (
            <article className="cart-item" key={item.variantId}>
              <Link href={`/product/${item.productId}`} className="cart-item-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} /> : <span className="empty-seal">ح</span>}</Link>
              <div className="cart-item-main"><div className="cart-item-top"><div><Link href={`/product/${item.productId}`} className="cart-item-name">{item.productName}</Link><span className="cart-item-category">{item.category === "women" ? "عبايات النساء" : "عبايات الأطفال"}</span></div><button className="icon-button danger" onClick={() => removeItem(item.variantId)} aria-label={`حذف ${item.productName}`}><Trash2 size={17} /></button></div><div className="cart-item-details"><span>المقاس: <strong>{item.size}</strong></span><span>{formatSar(item.unitPrice)}</span></div><div className="cart-item-bottom"><div className="quantity-stepper small-stepper"><button type="button" disabled={item.quantity <= 1} onClick={() => updateQuantity(item.variantId, item.quantity - 1)} aria-label="تقليل الكمية"><Minus size={13} /></button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= item.stock} onClick={() => updateQuantity(item.variantId, item.quantity + 1)} aria-label="زيادة الكمية"><Plus size={13} /></button></div><strong>{formatSar(Number(item.unitPrice) * item.quantity)}</strong><small>المتاح الآن {item.stock}</small></div></div>
            </article>
          ))}
          <Link href="/women" className="back-link"><ArrowLeft size={15} /> متابعة التسوق</Link>
        </section>
        <aside className="order-summary-card">
          <span className="eyebrow">ملخص الطلب</span><h2>الإجمالي</h2>
          <div className="summary-line"><span>قيمة المنتجات</span><strong>{formatSar(subtotal)}</strong></div>
          <div className="summary-line"><span>رسوم التوصيل</span><strong>تُحدد عند الإتمام</strong></div>
          <div className="summary-total"><span>الإجمالي قبل التوصيل</span><strong>{formatSar(subtotal)}</strong></div>
          <p>التوصيل داخل مكة يبدأ من 15 ريالًا وقد يزيد حسب بُعد الموقع. الاستلام من المنزل مجاني.</p>
          <Link href="/checkout" className="button button-gold button-full">إتمام الطلب <ArrowLeft size={16} /></Link>
          <span className="no-payment-note">لا يوجد دفع إلكتروني في الموقع حاليًا.</span>
        </aside>
      </div>
    </div>
  );
}
