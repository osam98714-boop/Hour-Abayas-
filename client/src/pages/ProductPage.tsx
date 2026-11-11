import { ArrowRight, ArrowUpLeft, Check, ChevronLeft, ChevronRight, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import NotFound from "./NotFound";
import SiteMessage from "@/components/store/SiteMessage";
import { useCart } from "@/contexts/CartContext";
import { uploadStoreImage } from "@/lib/uploads";
import { formatSar, type StoreProductDetail } from "@/lib/store-types";
import { trpc } from "@/lib/trpc";

function ProductRoute() {
  const [, params] = useRoute("/product/:id");
  const id = Number(params?.id);
  const productQuery = trpc.store.products.byId.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0, retry: false });
  const statusQuery = trpc.store.status.useQuery(undefined, { retry: false });
  const product = productQuery.data;
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  useEffect(() => { setActiveImage(0); setSelectedVariant(null); setQuantity(1); }, [id]);

  if (productQuery.isLoading || statusQuery.isLoading) return <div className="page-wrap page-loading">جارٍ تجهيز تفاصيل المنتج…</div>;
  if (productQuery.isError) return <div className="page-wrap"><SiteMessage title="تعذر تحميل المنتج" message="تحققي من اتصال المتجر وحاولي مرة أخرى." action={<button className="button button-dark" onClick={() => void productQuery.refetch()}>إعادة المحاولة</button>} /></div>;
  if (!product) {
    if (statusQuery.data?.databaseConfigured) return <NotFound />;
    return <div className="page-wrap"><SiteMessage title="تفاصيل المتجر قيد الإعداد" message="ستظهر تفاصيل المنتجات بعد ربط قاعدة بيانات Neon وإضافة المنتجات الحقيقية." action={<Link className="button button-dark" href="/">العودة للرئيسية</Link>} /></div>;
  }
  return <ProductDetails product={product} activeImage={activeImage} setActiveImage={setActiveImage} selectedVariant={selectedVariant} setSelectedVariant={setSelectedVariant} quantity={quantity} setQuantity={setQuantity} addItem={addItem} />;
}

function ProductDetails({
  product,
  activeImage,
  setActiveImage,
  selectedVariant,
  setSelectedVariant,
  quantity,
  setQuantity,
  addItem,
}: {
  product: StoreProductDetail;
  activeImage: number;
  setActiveImage: (index: number) => void;
  selectedVariant: number | null;
  setSelectedVariant: (id: number | null) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  addItem: (product: StoreProductDetail, variantId: number, quantity: number) => boolean;
}) {
  const image = product.images[activeImage];
  const variant = product.variants.find((item) => item.id === selectedVariant);
  const ratings = product.reviews.map((review) => review.rating);
  const averageRating = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
  const availableSizes = useMemo(() => product.variants.filter((item) => item.stock > 0), [product.variants]);

  function addToCart() {
    if (!variant || variant.stock <= 0) {
      toast.error("اختاري مقاسًا متاحًا أولًا.");
      return;
    }
    if (!addItem(product, variant.id, quantity)) {
      toast.error("تعذر إضافة هذا المقاس إلى السلة.");
      return;
    }
    toast.success("أُضيف المنتج إلى السلة.");
  }

  return (
    <div className="page-wrap product-page">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><Link href={product.category === "women" ? "/women" : "/kids"}>{product.category === "women" ? "عبايات النساء" : "عبايات الأطفال"}</Link><span>/</span><span>{product.name}</span></div>
      <div className="product-detail-layout">
        <section className="product-gallery" aria-label="صور المنتج">
          <div className="product-main-image">
            {image ? <img src={image.url} alt={image.alt || product.name} /> : <div className="product-image-empty product-image-large"><span className="empty-seal">ح</span><small>تُضاف صورة المنتج من الإدارة</small></div>}
            {product.images.length > 1 && <><button className="gallery-arrow gallery-prev" aria-label="الصورة السابقة" onClick={() => setActiveImage((activeImage + product.images.length - 1) % product.images.length)}><ChevronRight /></button><button className="gallery-arrow gallery-next" aria-label="الصورة التالية" onClick={() => setActiveImage((activeImage + 1) % product.images.length)}><ChevronLeft /></button></>}
          </div>
          {product.images.length > 1 && <div className="product-thumbnails">{product.images.map((item, index) => <button className={activeImage === index ? "thumbnail active" : "thumbnail"} key={item.id} onClick={() => setActiveImage(index)} aria-label={`عرض الصورة ${index + 1}`}><img src={item.url} alt="" /></button>)}</div>}
        </section>
        <section className="product-summary">
          <div className="product-overline"><span>{product.category === "women" ? "عبايات النساء" : "عبايات الأطفال"}</span>{averageRating !== null && <span className="rating-summary"><Star size={14} fill="currentColor" /> {averageRating.toFixed(1)} <small>({ratings.length})</small></span>}</div>
          <h1>{product.name}</h1>
          <div className="product-price">{formatSar(product.price)}</div>
          {product.description ? <p className="product-description">{product.description}</p> : <p className="product-description muted-note">تُضاف تفاصيل هذا المنتج من لوحة الإدارة.</p>}
          <div className="size-picker-block">
            <div className="size-picker-heading"><strong>اختاري المقاس</strong><span>{variant ? `المتوفر: ${variant.stock}` : "حددي المقاس المناسب"}</span></div>
            <div className="size-options">
              {product.variants.map((item) => <button type="button" key={item.id} className={`size-option ${selectedVariant === item.id ? "selected" : ""} ${item.stock < 1 ? "unavailable" : ""}`} disabled={item.stock < 1} onClick={() => { setSelectedVariant(item.id); setQuantity(1); }} aria-pressed={selectedVariant === item.id} title={item.stock < 1 ? "غير متوفر حاليًا" : `متوفر ${item.stock} قطعة`}>
                {item.size}{item.stock < 1 && <span className="size-cross" aria-hidden="true" />}
              </button>)}
              {product.variants.length === 0 && <p className="muted-note">لم تُسجّل المقاسات بعد.</p>}
            </div>
            {product.variants.some((item) => item.stock < 1) && <small className="unavailable-note">المقاس المشطوب غير متوفر حاليًا.</small>}
          </div>
          <div className="purchase-row">
            <div className="quantity-stepper" aria-label="الكمية">
              <button type="button" disabled={!variant || quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="تقليل الكمية"><Minus size={15} /></button>
              <span>{quantity}</span>
              <button type="button" disabled={!variant || quantity >= (variant?.stock ?? 0)} onClick={() => setQuantity(Math.min(variant?.stock ?? 1, quantity + 1))} aria-label="زيادة الكمية"><Plus size={15} /></button>
            </div>
            <button className="button button-dark add-cart-button" onClick={addToCart} disabled={!availableSizes.length}><ShoppingBag size={18} /> أضيفي إلى السلة</button>
          </div>
          <div className="product-assurances"><span><ShieldCheck size={17} /> يُراجع المخزون قبل تأكيد الإدارة</span><span><Check size={17} /> استلام مجاني من المنزل</span></div>
          <div className="product-details-list">
            <h2>تفاصيل القطعة</h2>
            {[ ["القماش", product.fabric], ["التطريز", product.embroidery], ["الأحجار", product.stones], ["التصميم", product.design] ].map(([label, value]) => <div key={label} className="detail-line"><span>{label}</span><p>{value || "تُضاف التفاصيل عند إدخال بيانات المنتج."}</p></div>)}
          </div>
        </section>
      </div>
      <Reviews productId={product.id} reviews={product.reviews} />
      <Link href={product.category === "women" ? "/women" : "/kids"} className="back-link"><ArrowRight size={16} /> العودة إلى التشكيلة</Link>
    </div>
  );
}

function Reviews({ productId, reviews }: { productId: number; reviews: StoreProductDetail["reviews"] }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const reviewMutation = trpc.store.products.submitReview.useMutation();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setUploading(true);
    try {
      const images: string[] = [];
      for (const file of files) images.push(await uploadStoreImage(file, "review", productId));
      await reviewMutation.mutateAsync({ productId, customerName: name, rating, comment, images });
      setName(""); setComment(""); setRating(5); setFiles([]);
      toast.success("وصل تقييمك، ويظهر بعد مراجعته من الإدارة.");
      await utils.store.products.byId.invalidate({ id: productId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال التقييم. تأكدي من جاهزية تخزين الصور.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="reviews-section" id="reviews">
      <div className="section-heading-row"><div className="section-heading-copy"><span className="eyebrow">تجارب حور</span><h2>آراء عميلاتنا</h2></div><span className="review-count">{reviews.length} تقييم منشور</span></div>
      {reviews.length > 0 ? <div className="reviews-grid">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-card-top"><div className="review-avatar">{review.customerName.slice(0, 1)}</div><div><strong>{review.customerName}</strong><span>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(review.createdAt))}</span></div><div className="review-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? "currentColor" : "none"} />)}</div></div><p>{review.comment || "تقييم لقطعة من حور."}</p>{review.images.length > 0 && <div className="review-photo-row">{review.images.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt="صورة مرفقة بالتقييم" loading="lazy" /></a>)}</div>}</article>)}</div> : <div className="review-empty"><Star size={20} /><span>لا توجد تقييمات منشورة بعد — كوني أول من يشارك رأيه.</span></div>}
      <form className="review-form" onSubmit={submit}>
        <div><span className="eyebrow">شاركي تجربتكِ</span><h3>أضيفي تقييمًا</h3></div>
        <label className="field-label">اسمكِ<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="الاسم الذي سيظهر مع التقييم" /></label>
        <div className="field-label"><span>تقييمكِ</span><div className="rating-select" dir="ltr" aria-label={`التقييم ${rating} من 5`}>{Array.from({ length: 5 }, (_, index) => <button type="button" key={index} onClick={() => setRating(index + 1)} aria-label={`${index + 1} نجوم`}><Star size={21} fill={index < rating ? "currentColor" : "none"} /></button>)}</div></div>
        <label className="field-label">التعليق<textarea maxLength={2000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="ما الذي أعجبكِ في القطعة؟" /></label>
        <label className="field-label">صور اختيارية<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} /><small>حتى 5 صور — تظهر بعد اعتماد الإدارة.</small></label>
        {files.length > 0 && <span className="file-summary">تم اختيار {files.length} صور · حتى 4 ميبيبايت للصورة</span>}
        <button className="button button-dark" type="submit" disabled={uploading || reviewMutation.isPending}>{uploading ? "جارٍ إرسال التقييم…" : "إرسال التقييم"}</button>
      </form>
    </section>
  );
}

export default ProductRoute;
