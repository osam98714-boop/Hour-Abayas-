import { BarChart3, ClipboardList, Contact, LogOut, MessageSquareText, Package, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SiteMessage from "@/components/store/SiteMessage";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminReviews from "@/components/admin/AdminReviews";
import AdminContacts from "@/components/admin/AdminContacts";

type Tab = "overview" | "products" | "orders" | "reviews" | "contacts";
const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "نظرة عامة", icon: BarChart3 },
  { id: "products", label: "المنتجات", icon: Package },
  { id: "orders", label: "الطلبات", icon: ClipboardList },
  { id: "reviews", label: "التقييمات", icon: MessageSquareText },
  { id: "contacts", label: "التواصل", icon: Contact },
];

export default function AdminPage() {
  const auth = useAuth();
  const status = trpc.store.status.useQuery(undefined, { retry: false });
  const [loginError, setLoginError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      setLoginError("");
      setPassword("");
      void auth.refresh();
    },
    onError: (error) => setLoginError(error.message),
  });

  if (status.isLoading || auth.loading) return <div className="page-wrap page-loading">جارٍ التحقق من صلاحية الدخول…</div>;
  if (status.isError) return <div className="page-wrap"><SiteMessage title="تعذر التحقق من إعدادات المتجر" message="تحققي من اتصال الخادم ثم حاولي مرة أخرى." action={<button className="button button-dark" onClick={() => { void status.refetch(); void auth.refresh(); }}>إعادة المحاولة <RefreshCw size={15} /></button>} /></div>;

  if (!status.data?.adminLoginConfigured) return <div className="page-wrap"><SiteMessage title="إعداد دخول الإدارة مطلوب" message="أضيفي ADMIN_USERNAME وADMIN_PASSWORD إلى متغيرات Vercel، وتأكدي من وجود MANUS_JWT_SECRET لتوقيع الجلسة. لا حاجة إلى إعداد Manus OAuth." /></div>;

  if (!auth.user) return (
    <div className="page-wrap admin-login-wrap">
      <form className="admin-login-card admin-login-form" onSubmit={(event) => {
        event.preventDefault();
        setLoginError("");
        login.mutate({ username, password });
      }}>
        <span className="admin-login-shield"><ShieldCheck size={29} /></span>
        <span className="eyebrow">منطقة خاصة</span>
        <h1>دخول إدارة حور</h1>
        <p>اكتبي اسم المستخدم وكلمة المرور اللذين ضبطتهما في متغيرات بيئة Vercel.</p>
        <label className="field-label">اسم المستخدم
          <input dir="ltr" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={128} />
        </label>
        <label className="field-label">كلمة المرور
          <input dir="ltr" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={256} />
        </label>
        {loginError && <div className="form-error" role="alert">{loginError}</div>}
        <button className="button button-dark button-full" type="submit" disabled={login.isPending}>
          {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول لوحة الإدارة"}
        </button>
        <small>لا يحتاج العملاء إلى حساب لإرسال طلباتهم.</small>
      </form>
    </div>
  );

  if (auth.user.role !== "admin") return <div className="page-wrap"><SiteMessage title="ليس لديكِ صلاحية الإدارة" message="هذا الحساب يستطيع تصفح المتجر فقط. تواصلي مع مالك متجر حور إذا كنتِ تحتاجين إلى صلاحية مدير." action={<button className="button button-quiet" onClick={() => void auth.logout()}>تسجيل الخروج</button>} /></div>;
  if (!status.data.databaseConfigured) return <div className="page-wrap"><SiteMessage title="لوحة الإدارة قيد التجهيز" message="تم تسجيل الدخول، لكن قاعدة PostgreSQL في Neon غير مربوطة أو لم تُطبّق ترحيلاتها بعد. بعد إعداد DATABASE_URL وتشغيل الترحيلات ستعمل إدارة المنتجات والطلبات." /></div>;

  return <AdminConsole userName={auth.user.name ?? "مدير المتجر"} onLogout={() => void auth.logout().catch(() => toast.error("تعذر تسجيل الخروج."))} />;
}

function AdminConsole({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const activeLabel = tabs.find((item) => item.id === tab)?.label ?? "الإدارة";
  return (
    <div className="page-wrap admin-page">
      <div className="admin-heading"><div><span className="eyebrow">لوحة إدارة حور</span><h1>{activeLabel}</h1><p>مرحبًا، {userName} — من هنا تُدار بيانات المتجر وطلباته.</p></div><button className="button button-quiet logout-button" onClick={onLogout}><LogOut size={15} /> تسجيل الخروج</button></div>
      <div className="admin-workspace">
        <nav className="admin-sidebar" aria-label="أقسام إدارة المتجر">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? "admin-tab active" : "admin-tab"} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span></button>)}<div className="admin-sidebar-note"><ShieldCheck size={16} /><span>بيانات الإدارة لا تظهر للزوار.</span></div></nav>
        <section className="admin-content">{tab === "overview" && <AdminOverview />}{tab === "products" && <AdminProducts />}{tab === "orders" && <AdminOrders />}{tab === "reviews" && <AdminReviews />}{tab === "contacts" && <AdminContacts />}</section>
      </div>
    </div>
  );
}
