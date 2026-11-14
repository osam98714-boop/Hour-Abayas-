import { ArrowUpLeft } from "lucide-react";
import { Link } from "wouter";
import type { StoreProduct } from "@/lib/store-types";
import { formatSar } from "@/lib/store-types";

export default function ProductCard({ product }: { product: StoreProduct }) {
  const image = product.images[0];
  const available = product.variants.some((variant) => variant.stock > 0);
  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="product-card-image" aria-label={`تفاصيل ${product.name}`}>
        {image ? <img src={image.url} alt={image.alt || product.name} loading="lazy" /> : (
          <div className="product-image-empty"><span className="empty-seal">ح</span><small>تُضاف صورة المنتج من الإدارة</small></div>
        )}
        {!available && <span className="stock-ribbon">نفد المخزون</span>}
        {product.soldCount >= 3 && <span className="best-seller-ribbon">الأكثر مبيعًا</span>}
      </Link>
      <div className="product-card-info">
        <div className="product-card-meta"><span>{product.category === "women" ? "عبايات النساء" : "عبايات الأطفال"}</span><span>{product.images.length ? `${product.images.length} صور` : "صور قريبًا"}</span></div>
        <Link href={`/product/${product.id}`} className="product-card-name">{product.name}</Link>
        <div className="product-card-bottom"><strong>{formatSar(product.price)}</strong><Link className="round-arrow" href={`/product/${product.id}`} aria-label="عرض التفاصيل"><ArrowUpLeft size={17} /></Link></div>
      </div>
    </article>
  );
}
