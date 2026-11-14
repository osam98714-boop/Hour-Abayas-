import { Check, ClipboardList, ExternalLink, MapPin, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatSar } from "@/lib/store-types";
import { trpc } from "@/lib/trpc";

const statusLabels: Record<string, string> = {
  received: "جديد — بانتظار التأكيد",
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  ready_for_pickup: "جاهز للاستلام",
  out_for_delivery: "في الطريق",
  completed: "مكتمل",
  cancelled: "ملغي",
};

type OrderUpdate = { status: string; deliveryFee: string };

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const [edits, setEdits] = useState<Record<number, OrderUpdate>>({});
  const query = trpc.admin.orders.list.useQuery(undefined, { retry: false });
  const update = trpc.admin.orders.update.useMutation({
    onSuccess: async () => {
      setEdits({});
      await utils.admin.orders.list.invalidate();
      await utils.admin.dashboard.invalidate();
      toast.success("حُدث الطلب.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل الطلبات…</div>;
  if (query.isError) return <div className="admin-inline-error">تعذر تحميل الطلبات.</div>;

  const orders = query.data ?? [];
  return (
    <div className="admin-panel admin-orders">
      <div className="admin-panel-heading">
        <div><span className="eyebrow">الطلبات الواردة</span><h2>إدارة الطلبات</h2></div>
        <span className="admin-panel-hint">آخر 200 طلب</span>
      </div>
      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => {
            const edit = edits[order.id] ?? { status: order.status, deliveryFee: order.deliveryFee };
            const terminal = order.status === "cancelled" || order.status === "completed";
            const statuses = Object.entries(statusLabels).filter(([value]) => {
              if (value === "received" && order.status !== "received") return false;
              if (value === "ready_for_pickup" && order.fulfillment !== "pickup") return false;
              if (value === "out_for_delivery" && order.fulfillment !== "delivery") return false;
              return true;
            });
            return (
              <article className="order-admin-card" key={order.id}>
                <div className="order-admin-header">
                  <div>
                    <strong className="order-code" dir="ltr">{order.orderCode}</strong>
                    <span className={`order-status-pill status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span>
                    <small>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</small>
                  </div>
                  <strong className="order-admin-total">{formatSar(order.total)}</strong>
                </div>
                {order.status === "received" && <p className="admin-panel-hint">لا يُحجز المخزون قبل تأكيد الطلب. عند التأكيد سيتحقق النظام مجددًا من توفر كل مقاس.</p>}
                <div className="order-customer-details">
                  <div><strong>{order.customerName}</strong><a href={`tel:${order.phone}`} dir="ltr">{order.phone} <ExternalLink size={12} /></a></div>
                  <div className="fulfillment-label">{order.fulfillment === "delivery" ? <><Truck size={15} /> توصيل داخل مكة</> : <><MapPin size={15} /> استلام مجاني من المنزل</>}</div>
                  {order.fulfillment === "delivery" && <>
                    <p className="order-address">{order.address}</p>
                    {(order.latitude === null || order.longitude === null) && <small className="manual-address-note">عنوان يدوي بلا دبوس؛ راجعي الموقع قبل تأكيد التوصيل.</small>}
                    {order.latitude !== null && order.longitude !== null && <a className="order-map-link" href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer"><MapPin size={15} /> فتح نقطة التسليم في Google Maps <small dir="ltr">{order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}</small></a>}
                  </>}
                </div>
                <div className="order-items-admin">
                  {order.items.map((item) => <div key={item.id}><span>{item.productName} · {item.size} × {item.quantity}</span><strong>{formatSar(item.lineTotal)}</strong></div>)}
                </div>
                <div className="order-admin-controls">
                  <label className="field-label">حالة الطلب
                    <select value={edit.status} disabled={terminal} onChange={(event) => setEdits({ ...edits, [order.id]: { ...edit, status: event.target.value } })}>
                      {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="field-label">رسوم التوصيل (ر.س.)
                    <input type="number" min="0" max="5000" step="0.5" value={edit.deliveryFee} disabled={order.fulfillment === "pickup" || terminal} onChange={(event) => setEdits({ ...edits, [order.id]: { ...edit, deliveryFee: event.target.value } })} />
                  </label>
                  <button className="button button-quiet" disabled={update.isPending || terminal} onClick={() => {
                    if (edit.status === "cancelled" && order.status !== "cancelled" && !window.confirm("سيُلغى الطلب نهائيًا. إذا سبق تأكيده، فستعود المقاسات إلى المخزون. هل تريدين المتابعة؟")) return;
                    update.mutate({ id: order.id, status: edit.status as typeof order.status, deliveryFee: Number(edit.deliveryFee) });
                  }}>
                    <Check size={15} /> حفظ الحالة والرسوم
                  </button>
                </div>
                {order.status === "cancelled" && <p className="admin-panel-hint">أُلغي الطلب نهائيًا؛ أعيد المخزون إذا كان قد حُجز عند تأكيده.</p>}
                {order.status === "completed" && <p className="admin-panel-hint">اكتمل الطلب ولا يمكن تغيير حالته.</p>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty"><ClipboardList size={20} /><span>لا توجد طلبات مسجلة بعد. ستظهر هنا طلبات العملاء المرسلة من الموقع.</span></div>
      )}
    </div>
  );
}
