import { ImagePlus, LoaderCircle, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadStoreImage } from "@/lib/uploads";
import { trpc } from "@/lib/trpc";

type AnnouncementForm = { id?: number; title: string; message: string; imageUrl: string | null; linkLabel: string; linkUrl: string; active: boolean };
const emptyAnnouncement = (): AnnouncementForm => ({ title: "", message: "", imageUrl: null, linkLabel: "", linkUrl: "", active: false });

export default function AdminAnnouncements() {
  const utils = trpc.useUtils();
  const query = trpc.admin.announcements.list.useQuery(undefined, { retry: false });
  const [form, setForm] = useState<AnnouncementForm>(emptyAnnouncement());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = trpc.admin.announcements.save.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.announcements.list.invalidate(), utils.store.announcements.active.invalidate()]);
      toast.success("حُفظ الإعلان.");
      setForm(emptyAnnouncement());
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.admin.announcements.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.announcements.list.invalidate(), utils.store.announcements.active.invalidate()]);
      toast.success("حُذف الإعلان.");
    },
    onError: (error) => toast.error(error.message),
  });

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadStoreImage(file, "announcement");
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع صورة الإعلان. تأكدي من ربط Vercel Blob.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function edit(announcement: NonNullable<typeof query.data>[number]) {
    setForm({ id: announcement.id, title: announcement.title, message: announcement.message, imageUrl: announcement.imageUrl, linkLabel: announcement.linkLabel ?? "", linkUrl: announcement.linkUrl ?? "", active: announcement.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await save.mutateAsync({ ...form, linkLabel: form.linkLabel.trim() || null, linkUrl: form.linkUrl.trim() || null });
    } catch { /* The mutation reports its user-safe error through onError. */ }
  }

  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل الإعلانات…</div>;
  if (query.isError) return <div className="admin-inline-error">تعذر تحميل الإعلانات. أعيدي المحاولة بعد التحقق من Neon.</div>;
  const announcements = query.data ?? [];

  return (
    <div className="admin-announcements">
      <form className="admin-panel" onSubmit={submit}>
        <div className="admin-panel-heading"><div><span className="eyebrow">رسالة للزائرات</span><h2>{form.id ? "تعديل الإعلان" : "إنشاء إعلان"}</h2></div>{form.id && <button type="button" className="button button-quiet" onClick={() => setForm(emptyAnnouncement())}>إلغاء التعديل</button>}</div>
        <label className="field-label">عنوان الإعلان<input required minLength={2} maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="مثال: وصل تشكيل جديد" /></label>
        <label className="field-label announcement-message-field">نص الإعلان<textarea required maxLength={3000} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="اكتبي رسالة قصيرة وواضحة للزائرات." /></label>
        <div className="admin-announcement-image">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void handleImage(event.target.files?.[0])} />
          {form.imageUrl ? <div className="announcement-image-preview"><img src={form.imageUrl} alt="معاينة صورة الإعلان" /><button type="button" className="image-remove" onClick={() => setForm({ ...form, imageUrl: null })} aria-label="إزالة صورة الإعلان"><X size={14} /></button></div> : <button type="button" className="button button-quiet" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}{uploading ? "جارٍ رفع الصورة…" : "إضافة صورة اختيارية"}</button>}
        </div>
        <div className="form-grid">
          <label className="field-label">نص الزر (اختياري)<input maxLength={60} value={form.linkLabel} onChange={(event) => setForm({ ...form, linkLabel: event.target.value })} placeholder="مثال: اكتشفي المجموعة" /></label>
          <label className="field-label">رابط الزر (اختياري)<input type="url" maxLength={1200} value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} placeholder="https://…" dir="ltr" /></label>
        </div>
        <label className="publish-switch announcement-active-switch"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>إظهار الإعلان للزوار</strong><small>إذا فُعّل هذا الإعلان، سيُوقف الإعلان النشط الآخر.</small></span></label>
        <div className="form-actions"><button type="submit" className="button button-gold" disabled={save.isPending || uploading}><Plus size={15} />{save.isPending ? "جارٍ الحفظ…" : form.id ? "حفظ التعديل" : "حفظ الإعلان"}</button><small>يظهر الإعلان النشط مرة واحدة في الجلسة عند أول زيارة للمتجر.</small></div>
      </form>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">المحفوظات</span><h2>الإعلانات المسجلة</h2></div><span className="admin-panel-hint">{announcements.length} إعلان</span></div>
        {announcements.length ? <div className="admin-announcement-list">{announcements.map((announcement) => <article className="admin-announcement-row" key={announcement.id}>
          <div className="admin-announcement-thumb">{announcement.imageUrl ? <img src={announcement.imageUrl} alt="" /> : <Megaphone size={19} />}</div>
          <div className="admin-announcement-info"><strong>{announcement.title}</strong><span>{announcement.message}</span></div>
          <span className={announcement.active ? "publish-status published" : "publish-status"}>{announcement.active ? "نشط" : "متوقف"}</span>
          <div className="admin-row-actions"><button type="button" className="icon-button" onClick={() => edit(announcement)} aria-label="تعديل الإعلان"><Pencil size={15} /></button><button type="button" className="icon-button danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`حذف إعلان «${announcement.title}»؟`)) remove.mutate({ id: announcement.id }); }} aria-label="حذف الإعلان"><Trash2 size={15} /></button></div>
        </article>)}</div> : <div className="admin-empty"><Megaphone size={20} /><span>لا توجد إعلانات. لن يظهر شيء للزوار حتى تنشئي إعلانًا وتفعّليه.</span></div>}
      </section>
    </div>
  );
}
