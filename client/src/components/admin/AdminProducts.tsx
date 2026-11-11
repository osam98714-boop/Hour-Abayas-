import { ImagePlus, LoaderCircle, Package, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadStoreImage } from "@/lib/uploads";
import { formatSar, type StoreProduct } from "@/lib/store-types";
import { trpc } from "@/lib/trpc";

type VariantInput = { size: string; stock: number };
type ProductForm = { id?: number; name: string; category: "women" | "kids"; price: string; description: string; fabric: string; embroidery: string; stones: string; design: string; isPublished: boolean; images: Array<{ url: string; alt: string }>; variants: VariantInput[] };
const newProduct = (): ProductForm => ({ category: "women", name: "", price: "", description: "", fabric: "", embroidery: "", stones: "", design: "", isPublished: false, images: [], variants: [{ size: "", stock: 0 }] });

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const query = trpc.admin.products.list.useQuery(undefined, { retry: false });
  const save = trpc.admin.products.save.useMutation({ onSuccess: async () => { await utils.admin.products.list.invalidate(); await utils.store.products.list.invalidate(); toast.success("حُفظ المنتج بنجاح."); setForm(newProduct()); } });
  const remove = trpc.admin.products.delete.useMutation({ onSuccess: async () => { await utils.admin.products.list.invalidate(); await utils.store.products.list.invalidate(); toast.success("حُذف المنتج وصوره المسجلة."); }, onError: (error) => toast.error(error.message) });
  const [form, setForm] = useState<ProductForm>(newProduct());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function edit(product: StoreProduct) {
    setForm({ id: product.id, name: product.name, category: product.category, price: product.price, description: product.description, fabric: product.fabric, embroidery: product.embroidery, stones: product.stones, design: product.design, isPublished: product.isPublished, images: product.images.map((image) => ({ url: image.url, alt: image.alt })), variants: product.variants.map((variant) => ({ size: variant.size, stock: variant.stock })) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImages(files: FileList | null) {
    if (!files?.length) return;
    const remaining = 40 - form.images.length;
    const chosen = Array.from(files).slice(0, remaining);
    if (Array.from(files).length > remaining) toast.message("الحد الأقصى 40 صورة لكل منتج.");
    setUploading(true);
    try {
      const images = [...form.images];
      for (const file of chosen) images.push({ url: await uploadStoreImage(file, "product"), alt: form.name.trim() });
      setForm((current) => ({ ...current, images }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع الصورة. تأكدي من ربط Vercel Blob.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const variants = form.variants.filter((variant) => variant.size.trim());
      await save.mutateAsync({ ...form, price: Number(form.price), variants });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المنتج.");
    }
  }

  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل المنتجات…</div>;
  if (query.isError) return <div className="admin-inline-error">تعذر تحميل المنتجات. أعيدي المحاولة بعد التحقق من Neon.</div>;
  const products = query.data ?? [];

  return (
    <div className="admin-products">
      <form className="admin-panel product-editor" onSubmit={submit}>
        <div className="admin-panel-heading"><div><span className="eyebrow">بيانات الكتالوج</span><h2>{form.id ? "تعديل منتج" : "إضافة منتج حقيقي"}</h2></div>{form.id && <button type="button" className="button button-quiet" onClick={() => setForm(newProduct())}>إلغاء التعديل</button>}</div>
        <div className="form-grid">
          <label className="field-label">اسم المنتج<input required minLength={2} maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field-label">القسم<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductForm["category"] })}><option value="women">عبايات النساء</option><option value="kids">عبايات الأطفال</option></select></label>
          <label className="field-label">السعر (ريال سعودي)<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label className="field-label publish-switch"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /> نشر المنتج في المتجر</label>
        </div>
        <label className="field-label">الوصف<textarea rows={3} maxLength={6000} required={form.isPublished} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="form-grid detail-inputs"><label className="field-label">تفاصيل القماش<input required={form.isPublished} maxLength={1200} value={form.fabric} onChange={(event) => setForm({ ...form, fabric: event.target.value })} /></label><label className="field-label">التطريز<input maxLength={1200} value={form.embroidery} onChange={(event) => setForm({ ...form, embroidery: event.target.value })} placeholder="أدخلي التفاصيل أو اكتبي: بدون تطريز" /></label><label className="field-label">الأحجار<input maxLength={1200} value={form.stones} onChange={(event) => setForm({ ...form, stones: event.target.value })} placeholder="أدخلي التفاصيل أو اكتبي: بدون أحجار" /></label><label className="field-label">تفاصيل التصميم<input required={form.isPublished} maxLength={1200} value={form.design} onChange={(event) => setForm({ ...form, design: event.target.value })} /></label></div>
        <div className="admin-subsection"><div className="admin-subsection-heading"><div><h3>المقاسات والمخزون</h3><p>أدخلي كمية مستقلة لكل مقاس. المقاس ذو الكمية صفر يظهر غير متوفر.</p></div><button type="button" className="button button-quiet" disabled={form.variants.length >= 30} onClick={() => setForm({ ...form, variants: [...form.variants, { size: "", stock: 0 }] })}><Plus size={15} /> إضافة مقاس</button></div>
          <div className="variant-editor-list">{form.variants.map((variant, index) => <div className="variant-editor-row" key={index}><label className="field-label">المقاس<input required maxLength={32} value={variant.size} onChange={(event) => setForm({ ...form, variants: form.variants.map((item, itemIndex) => itemIndex === index ? { ...item, size: event.target.value } : item) })} placeholder="مثل 54 أو 6 سنوات" /></label><label className="field-label">الكمية<input required type="number" min="0" max="9999" step="1" value={variant.stock} onChange={(event) => setForm({ ...form, variants: form.variants.map((item, itemIndex) => itemIndex === index ? { ...item, stock: Number(event.target.value) } : item) })} /></label><button type="button" className="icon-button danger" disabled={form.variants.length <= 1} onClick={() => setForm({ ...form, variants: form.variants.filter((_, itemIndex) => itemIndex !== index) })} aria-label="حذف المقاس"><X size={16} /></button></div>)}</div>
        </div>
        <div className="admin-subsection"><div className="admin-subsection-heading"><div><h3>صور المنتج <small>({form.images.length}/40)</small></h3><p>تُرفع الصور إلى Vercel Blob. يمكنك إضافة أكثر من 15 صورة.</p></div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => void handleImages(event.target.files)} /><button type="button" className="button button-quiet" disabled={uploading || form.images.length >= 40} onClick={() => fileRef.current?.click()}>{uploading ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />} {uploading ? "جارٍ الرفع…" : "اختيار صور"}</button></div>
          {form.images.length ? <div className="admin-image-grid">{form.images.map((image, index) => <div className="admin-image-thumb" key={image.url}><img src={image.url} alt={image.alt || `صورة المنتج ${index + 1}`} /><button type="button" className="image-remove" onClick={() => setForm({ ...form, images: form.images.filter((_, itemIndex) => itemIndex !== index) })} aria-label="إزالة الصورة"><X size={14} /></button><span>{index + 1}</span></div>)}</div> : <div className="upload-empty"><Upload size={18} /><span>لم تُرفع صور لهذا المنتج بعد.</span></div>}
        </div>
        <div className="form-actions"><button className="button button-gold" type="submit" disabled={save.isPending || uploading}><Plus size={16} />{save.isPending ? "جارٍ الحفظ…" : form.id ? "حفظ التعديلات" : "حفظ المنتج"}</button><small>لن يُنشر المنتج قبل إدخال الصور والتفاصيل الحقيقية واختيار النشر.</small></div>
      </form>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">الكتالوج</span><h2>المنتجات المسجلة</h2></div><span className="admin-panel-hint">{products.length} منتج</span></div>
      {products.length ? <div className="admin-product-list">{products.map((product) => <article className="admin-product-row" key={product.id}><div className="admin-product-thumb">{product.images[0] ? <img src={product.images[0].url} alt="" /> : <span>ح</span>}</div><div className="admin-product-info"><strong>{product.name}</strong><span>{product.category === "women" ? "نساء" : "أطفال"} · {formatSar(product.price)} · {product.variants.length} مقاسات</span></div><span className={product.isPublished ? "publish-status published" : "publish-status"}>{product.isPublished ? "منشور" : "مسودة"}</span><div className="admin-row-actions"><button className="icon-button" onClick={() => edit(product)} aria-label="تعديل المنتج"><Pencil size={16} /></button><button className="icon-button danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`حذف «${product.name}» نهائيًا؟`)) remove.mutate({ id: product.id }); }} aria-label="حذف المنتج"><Trash2 size={16} /></button></div></article>)}</div> : <div className="admin-empty"><Package size={20} /><span>لا توجد منتجات بعد. لا تُضاف منتجات وهمية تلقائيًا.</span></div>}
      </section>
    </div>
  );
}
