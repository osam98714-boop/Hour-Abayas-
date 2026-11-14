import { ArrowUpLeft, Instagram, MessageCircle, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import AnnouncementDialog from "@/components/store/AnnouncementDialog";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { itemCount } = useCart();
  const linksQuery = trpc.store.contacts.list.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const announcementQuery = trpc.store.announcements.active.useQuery(undefined, { enabled: location !== "/admin", retry: false, staleTime: 60_000 });
  const links = linksQuery.data ?? [];
  const [visibleAnnouncementId, setVisibleAnnouncementId] = useState<number | null>(null);

  useEffect(() => {
    const announcement = announcementQuery.data;
    if (!announcement || location === "/admin") {
      setVisibleAnnouncementId(null);
      return;
    }
    const key = `hour-announcement-dismissed-${announcement.id}`;
    try {
      if (window.sessionStorage.getItem(key)) {
        setVisibleAnnouncementId(null);
        return;
      }
    } catch { /* If browser storage is unavailable, still show the announcement once in this render. */ }
    setVisibleAnnouncementId(announcement.id);
  }, [announcementQuery.data, location]);

  const closeAnnouncement = useCallback(() => {
    const announcement = announcementQuery.data;
    if (announcement) {
      try { window.sessionStorage.setItem(`hour-announcement-dismissed-${announcement.id}`, "1"); } catch { /* Dismissal remains local to this view. */ }
    }
    setVisibleAnnouncementId(null);
  }, [announcementQuery.data]);

  const activeAnnouncement = announcementQuery.data && announcementQuery.data.id === visibleAnnouncementId ? announcementQuery.data : null;

  return (
    <div className="site-frame" dir="rtl">
      <div className="announcement-bar">
        <span>أناقة .. بكل تفاصيلها</span>
        <span className="announcement-divider" aria-hidden="true" />
        <span>التوصيل داخل مكة المكرمة</span>
      </div>
      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="حور — الصفحة الرئيسية">
          <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
          <span className="brand-name-wrap">
            <strong className="brand-name">حور</strong>
            <span className="brand-latin">HOUR ABAYAS</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <Link href="/" className={location === "/" ? "nav-link active" : "nav-link"}>الرئيسية</Link>
          <Link href="/women" className={location === "/women" ? "nav-link active" : "nav-link"}>عبايات النساء</Link>
          <Link href="/kids" className={location === "/kids" ? "nav-link active" : "nav-link"}>عبايات الأطفال</Link>
          <Link href="/my-order" className={location === "/my-order" ? "nav-link active" : "nav-link"}>متابعة الطلب</Link>
        </nav>
        <div className="header-actions">
          <Link href="/cart" className="cart-link" aria-label={`السلة، ${itemCount} قطعة`}>
            <ShoppingBag size={19} strokeWidth={1.6} />
            <span className="cart-label">السلة</span>
            {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
          </Link>
          <Link href="/admin" className="admin-shortcut">الإدارة</Link>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" className="brand-lockup footer-logo" aria-label="حور — الصفحة الرئيسية">
              <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
              <span className="brand-name-wrap"><strong className="brand-name">حور</strong><span className="brand-latin">HOUR ABAYAS</span></span>
            </Link>
            <p>أناقة .. بكل تفاصيلها</p>
            <span className="footer-location">مكة المكرمة · عبايات نسائية وأطفال</span>
          </div>
          <div className="footer-links-block">
            <h2>تصفّحي المتجر</h2>
            <Link href="/women">عبايات النساء</Link>
            <Link href="/kids">عبايات الأطفال</Link>
            <Link href="/cart">سلة المشتريات</Link>
            <Link href="/my-order">متابعة الطلب</Link>
          </div>
          <div className="footer-links-block contact-block">
            <h2>تواصلي معنا</h2>
            {links.length > 0 ? links.map((link) => {
              const Icon = link.channel === "whatsapp" ? MessageCircle : link.channel === "instagram" ? Instagram : ArrowUpLeft;
              return <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="contact-link"><Icon size={16} />{link.label}</a>;
            }) : <p className="muted-note">تُضاف قنوات التواصل من لوحة الإدارة عند تجهيز المتجر.</p>}
          </div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} حور — HOUR ABAYAS</span><span>صُنع بعناية في مكة المكرمة</span></div>
      </footer>
      {activeAnnouncement && <AnnouncementDialog announcement={activeAnnouncement} onClose={closeAnnouncement} />}
    </div>
  );
}
