import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import ProductCard from "@/components/store/ProductCard";
import { trpc } from "@/lib/trpc";

export default function CategoryPage({ category }: { category: "women" | "kids" }) {
  const [size, setSize] = useState("");
  const title = category === "women" ? "عبايات النساء" : "عبايات الأطفال";
  const allQuery = trpc.store.products.list.useQuery({ category }, { retry: false, staleTime: 60_000 });
  const filteredQuery = trpc.store.products.list.useQuery({ category, ...(size ? { size } : {}) }, { retry: false, staleTime: 60_000 });
  const sizes = useMemo(() => Array.from(new Set((allQuery.data ?? []).flatMap((product) => product.variants.filter((variant) => variant.stock > 0).map((variant) => variant.size)))).sort(), [allQuery.data]);
  const products = filteredQuery.data ?? [];

  return (
    <div className="catalog-page page-wrap">
      <div className="breadcrumbs"><Link href="/">الرئيسية</Link><span>/</span><span>{title}</span></div>
      <div className="catalog-head">
        <div><span className="eyebrow">تشكيلة حور</span><h1>{title}</h1><p>{category === "women" ? "اختاري القطعة التي تعبّر عن أناقتكِ." : "تفاصيل رقيقة صُنعت لتناسب صغيراتكِ."}</p></div>
        <span className="catalog-count">{allQuery.data?.length ?? 0}<small> قطعة</small></span>
      </div>
      <div className="catalog-toolbar">
        <label className="filter-label" htmlFor="size-filter"><SlidersHorizontal size={17} /> المقاس</label>
        <select id="size-filter" value={size} onChange={(event) => setSize(event.target.value)} className="filter-select">
          <option value="">كل المقاسات المتاحة</option>
          {sizes.map((availableSize) => <option key={availableSize} value={availableSize}>{availableSize}</option>)}
        </select>
        {size && <button type="button" className="clear-filter" onClick={() => setSize("")}>مسح التصفية <span>×</span></button>}
        <span className="toolbar-spacer" />
        <span className="result-count">{filteredQuery.isLoading ? "جارٍ التحميل…" : `${products.length} نتيجة`}</span>
      </div>
      {filteredQuery.isError ? <div className="inline-state error-state"><p>تعذر تحميل هذا القسم.</p><button className="button button-quiet" onClick={() => void filteredQuery.refetch()}>إعادة المحاولة</button></div> : null}
      {filteredQuery.isLoading ? <div className="product-grid"><div className="product-skeleton" /><div className="product-skeleton" /><div className="product-skeleton" /></div> : null}
      {!filteredQuery.isLoading && !filteredQuery.isError && products.length > 0 ? <div className="product-grid catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : null}
      {!filteredQuery.isLoading && !filteredQuery.isError && products.length === 0 ? (
        <div className="catalog-empty">
          <span className="empty-emblem">ح</span>
          <h2>{size ? `لا توجد قطع متاحة بالمقاس ${size}` : "التشكيلة قيد التجهيز"}</h2>
          <p>{size ? "جرّبي مقاسًا آخر، أو عودي إلى جميع القطع المتاحة." : "ستظهر هنا منتجات حور الحقيقية بعد إضافتها من لوحة الإدارة."}</p>
          {size ? <button className="text-link" onClick={() => setSize("")}>عرض كل المقاسات <ArrowLeft size={16} /></button> : <Link href="/" className="text-link">العودة للرئيسية <ArrowLeft size={16} /></Link>}
        </div>
      ) : null}
      <div className="delivery-note"><span className="delivery-note-icon">ح</span><p>التوصيل متاح داخل مكة المكرمة — 15 ريالًا رسومًا أساسية، وقد تتغير بحسب بُعد الموقع. والاستلام من المنزل مجاني.</p></div>
    </div>
  );
}
