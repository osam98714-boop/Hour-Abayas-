import { Contact, ExternalLink, Instagram, Link2, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const channelLabels: Record<string, string> = { whatsapp: "واتساب", instagram: "إنستغرام", snapchat: "سناب شات", tiktok: "تيك توك", facebook: "فيسبوك", group: "مجموعة / قناة", other: "رابط آخر" };
function ContactIcon({ channel }: { channel: string }) { return channel === "whatsapp" ? <MessageCircle size={17} /> : channel === "instagram" ? <Instagram size={17} /> : <Link2 size={17} />; }

export default function AdminContacts() {
  const utils = trpc.useUtils();
  const query = trpc.admin.contacts.list.useQuery(undefined, { retry: false });
  const create = trpc.admin.contacts.create.useMutation({ onSuccess: async () => { await utils.admin.contacts.list.invalidate(); await utils.store.contacts.list.invalidate(); setLabel(""); setUrl(""); toast.success("أضيف رابط التواصل."); } });
  const remove = trpc.admin.contacts.delete.useMutation({ onSuccess: async () => { await utils.admin.contacts.list.invalidate(); await utils.store.contacts.list.invalidate(); toast.success("حُذف الرابط."); } });
  const [label, setLabel] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try { await create.mutateAsync({ label, channel: channel as "whatsapp" | "instagram" | "snapchat" | "tiktok" | "facebook" | "group" | "other", url }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "تعذر إضافة الرابط."); }
  }
  if (query.isLoading) return <div className="admin-loading">جارٍ تحميل روابط التواصل…</div>;
  if (query.isError) return <div className="admin-inline-error">تعذر تحميل روابط التواصل.</div>;
  const links = query.data ?? [];
  return (
    <div className="contact-admin-grid">
      <form className="admin-panel contact-form" onSubmit={submit}><div className="admin-panel-heading"><div><span className="eyebrow">قنوات المتجر</span><h2>إضافة رابط تواصل</h2></div><Contact size={19} /></div><label className="field-label">اسم الرابط<input required minLength={2} maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="مثل: واتساب حور" /></label><label className="field-label">نوع القناة<select value={channel} onChange={(event) => setChannel(event.target.value)}>{Object.entries(channelLabels).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label><label className="field-label">الرابط<input required type="url" maxLength={1200} value={url} onChange={(event) => setUrl(event.target.value)} dir="ltr" placeholder="https://…" /></label><small className="muted-note">لرقم واتساب استخدمي https://wa.me/ مع رمز الدولة والرقم دون + أو مسافات. يمكن إضافة رابط مجموعة.</small>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-gold" type="submit" disabled={create.isPending}><Plus size={16} />{create.isPending ? "جارٍ الإضافة…" : "إضافة الرابط"}</button></form>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">الرابط العام</span><h2>روابط تظهر في المتجر</h2></div><span className="admin-panel-hint">{links.length} رابط</span></div>{links.length ? <div className="contact-admin-list">{links.map((link) => <article className="contact-admin-row" key={link.id}><span className="contact-admin-icon"><ContactIcon channel={link.channel} /></span><div><strong>{link.label}</strong><span>{channelLabels[link.channel] ?? "رابط"}</span></div><a href={link.url} target="_blank" rel="noreferrer" className="icon-button" aria-label="فتح الرابط"><ExternalLink size={15} /></a><button className="icon-button danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`حذف رابط «${link.label}»؟`)) remove.mutate({ id: link.id }); }} aria-label="حذف الرابط"><Trash2 size={16} /></button></article>)}</div> : <div className="admin-empty"><Contact size={20} /><span>لا توجد روابط بعد. أضيفي قنوات المتجر الحقيقية لتظهر في التذييل.</span></div>}</section>
    </div>
  );
}
