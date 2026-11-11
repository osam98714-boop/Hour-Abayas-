import { Check, Image as ImageIcon, MessageSquareText, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AdminReviews() {
  const utils = trpc.useUtils();
  const query = trpc.admin.reviews.list.useQuery(undefined, { retry: false });
  const approve = trpc.admin.reviews.setApproved.useMutation({ onSuccess: async () => { await utils.admin.reviews.list.invalidate(); await utils.admin.dashboard.invalidate(); await utils.store.products.invalidate(); toast.success("حُدّثت حالة التقييم."); } });
  const remove = trpc.admin.reviews.delete.useMutation({ onSuccess: async () => { await utils.admin.reviews.list.invalidate(); await utils.admin.dashboard.invalidate(); await utils.store.products.invalidate(); toast.success("حُذف التقييم وصوره."); } });
  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل التقييمات…</div>;
  if (query.isError) return <div className="admin-inline-error">تعذر تحميل التقييمات.</div>;
  const reviews = query.data ?? [];
  const pending = reviews.filter((review) => !review.approved).length;
  return (
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">مراجعة المحتوى</span><h2>تقييمات العملاء</h2></div><span className="review-count">{pending} بانتظار الاعتماد</span></div>
      {reviews.length ? <div className="admin-review-list">{reviews.map((review) => <article className="admin-review-card" key={review.id}><div className="admin-review-main"><div className="admin-review-header"><div><strong>{review.customerName}</strong><span>عن: {review.productName}</span></div><span className={review.approved ? "publish-status published" : "publish-status"}>{review.approved ? "منشور" : "بانتظار المراجعة"}</span></div><div className="review-stars admin-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"} />)}</div><p>{review.comment || "بدون تعليق نصي."}</p>{review.images.length ? <div className="admin-review-images">{review.images.map((image) => <a href={image.url} target="_blank" rel="noreferrer" key={image.id}><img src={image.url} alt="صورة مرفقة بالتقييم" /><ImageIcon size={12} /></a>)}</div> : null}<small>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(review.createdAt))}</small></div><div className="admin-row-actions vertical-actions"><button type="button" className="icon-button" disabled={approve.isPending} onClick={() => approve.mutate({ id: review.id, approved: !review.approved })} aria-label={review.approved ? "إخفاء التقييم" : "اعتماد التقييم"}>{review.approved ? <X size={16} /> : <Check size={16} />}</button><button type="button" className="icon-button danger" disabled={remove.isPending} onClick={() => { if (window.confirm("حذف هذا التقييم وصوره نهائيًا؟")) remove.mutate({ id: review.id }); }} aria-label="حذف التقييم"><Trash2 size={16} /></button></div></article>)}</div> : <div className="admin-empty"><MessageSquareText size={20} /><span>لا توجد تقييمات بعد.</span></div>}
    </section>
  );
}
