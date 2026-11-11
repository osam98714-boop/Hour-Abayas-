import { useMemo } from "react";
import { ArrowLeft, ArrowUpLeft, ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/store/ProductCard";
import type { StoreProduct } from "@/lib/store-types";

function randomSample(products: StoreProduct[]) {
  const shuffled = [...products];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const next = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return shuffled.slice(0, 4);
}

function ProductSection({ category, label, title, href }: { category: "women" | "kids"; label: string; title: string; href: string }) {
  const query = trpc.store.products.list.useQuery({ category }, { retry: false, staleTime: 60_000 });
  const products = query.data ?? [];
  const selection = useMemo(() => randomSample(products), [products]);
  return (
    <section className="home-product-section" aria-labelledby={`${category}-heading`}>
      <div className="section-heading-row">
        <div className="section-heading-copy"><span className="eyebrow">{label}</span><h2 id={`${category}-heading`}>{title}</h2></div>
        <Link href={href} className="text-link">عرض الكل <ArrowLeft size={16} /></Link>
      </div>
      {query.isLoading ? <div className="product-grid"><div className="product-skeleton" /><div className="product-skeleton" /><div className="product-skeleton" /></div> : null}
      {query.isError ? <div className="inline-state error-state"><p>تعذر تحميل المنتجات الآن.</p><button className="button button-quiet" onClick={() => void query.refetch()}>إعادة المحاولة</button></div> : null}
      {!query.isLoading && !query.isError && selection.length > 0 ? <div className="product-grid">{selection.map((product) => <ProductCard key={product.id} product={product} />)}</div> : null}
      {!query.isLoading && !query.isError && selection.length === 0 ? (
        <div className="catalog-empty">
          <span className="empty-emblem">ح</span>
          <h3>تُضاف التشكيلة قريبًا</h3>
          <p>ستظهر هنا منتجات حور الحقيقية بعد إدخالها في لوحة الإدارة.</p>
          <Link href={href} className="text-link">اكتشفي القسم <ChevronLeft size={16} /></Link>
        </div>
      ) : null}
    </section>
  );
}

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><Sparkles size={14} /> أناقة محلية بروح حور</span>
          <h1>أناقةٌ تليق<br /><em>بكل تفاصيلكِ</em></h1>
          <p>عبايات نسائية وقطع للصغيرات، تُصنع بعناية في مكة المكرمة لترافق لحظاتكِ كما تحبين.</p>
          <div className="hero-actions">
            <Link href="/women" className="button button-gold">تسوقي عبايات النساء <ArrowUpLeft size={17} /></Link>
            <Link href="/kids" className="button button-outline-light">تشكيلة الأطفال</Link>
          </div>
          <div className="hero-footnote"><span className="gold-dot" /> تفصيل محلي · توصيل داخل مكة</div>
        </div>
        <div className="hero-art" aria-label="نسيج زخرفي تجريدي بألوان المتجر">
          <div className="hero-art-halo" />
          <div className="hero-art-arch"><span className="hero-art-monogram">ح</span><span className="hero-art-caption">HOUR<br />ABAYAS</span></div>
          <div className="hero-art-side-note">أناقة<br />بكل تفاصيلها</div>
          <span className="hero-art-line hero-art-line-one" /><span className="hero-art-line hero-art-line-two" />
        </div>
        <div className="hero-index"><span>01</span><i /> حور · مكة المكرمة</div>
      </section>

      <section className="story-strip" aria-label="عن حور">
        <div className="story-mark">ح</div><p>من مكة، تُصنع كل قطعة بحبّ واهتمام — <span>أناقة .. بكل تفاصيلها</span></p><Link href="/women" aria-label="اكتشفي التشكيلة"><ArrowUpLeft size={18} /></Link>
      </section>

      <div className="home-sections">
        <ProductSection category="women" label="لإطلالتكِ" title="عبايات النساء" href="/women" />
        <section className="kids-callout">
          <div><span className="eyebrow">لصغيراتنا الجميلات</span><h2>أناقة صغيرة<br />بروح كبيرة</h2><p>تصاميم أطفال تُصنع بعناية، لتكون التفاصيل الجميلة جزءًا من يومهن.</p><Link href="/kids" className="button button-dark">اكتشفي عبايات الأطفال <ArrowUpLeft size={16} /></Link></div>
          <div className="kids-callout-art" aria-hidden="true"><span>ح</span><i /></div>
        </section>
        <ProductSection category="kids" label="لصغيراتكِ" title="عبايات الأطفال" href="/kids" />
      </div>
      <section className="closing-note"><span className="eyebrow">حور · HOUR ABAYAS</span><p>اختاري ما يشبهكِ، واتركي التفاصيل علينا.</p><Link href="/women" className="text-link">تصفحي التشكيلة <ArrowLeft size={16} /></Link></section>
    </div>
  );
}
