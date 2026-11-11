import { ArrowLeft, BadgeCheck, ClipboardList, Package, Star } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatSar } from "@/lib/store-types";

export default function AdminOverview() {
  const query = trpc.admin.dashboard.useQuery(undefined, { retry: false, staleTime: 15_000 });
  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل الإحصاءات…</div>;
  if (query.isError || !query.data) return <div className="admin-inline-error">تعذر تحميل الإحصاءات. تأكدي من اكتمال إعداد قاعدة البيانات.</div>;
  const stats = query.data;
  const cards = [
    { label: "إجمالي المنتجات", value: stats.products, note: `${stats.publishedProducts} منشور`, icon: Package },
    { label: "الطلبات", value: stats.orders, note: `${stats.newOrders} جديد بانتظار المراجعة`, icon: ClipboardList },
    { label: "تقييمات للمراجعة", value: stats.pendingReviews, note: "لن تظهر للزوار قبل اعتمادها", icon: Star },
  ];
  return (
    <div className="admin-overview">
      <div className="admin-stat-grid">{cards.map(({ label, value, note, icon: Icon }) => <article className="admin-stat-card" key={label}><div className="admin-stat-icon"><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">الأحدث</span><h2>آخر الطلبات</h2></div><span className="admin-panel-hint">تُحدّث القائمة من لوحة الإدارة</span></div>
        {stats.recentOrders.length ? <div className="recent-orders-list">{stats.recentOrders.map((order) => <div className="recent-order-row" key={order.id}><div><strong dir="ltr">{order.orderCode}</strong><span>{order.customerName} · {order.fulfillment === "delivery" ? "توصيل" : "استلام مجاني"}</span></div><div><b>{formatSar(order.total)}</b><span className={`order-status-pill status-${order.status}`}>{order.status}</span></div></div>)}</div> : <div className="admin-empty"><BadgeCheck size={20} /><span>لا توجد طلبات حتى الآن.</span></div>}
        <Link href="/admin" className="admin-inline-link">إدارة الطلبات <ArrowLeft size={15} /></Link>
      </section>
      <div className="admin-notice"><span className="notice-gold-dot" /><p>يبدأ المخزون فعليًا بعد إدخال المنتجات والمقاسات والكميات الحقيقية. لا توجد منتجات تجريبية محفوظة في قاعدة البيانات.</p></div>
    </div>
  );
}
