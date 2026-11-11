import { Link } from "wouter";
import SiteMessage from "@/components/store/SiteMessage";

export default function NotFound() {
  return <div className="page-wrap"><SiteMessage title="هذه الصفحة غير موجودة" message="قد يكون الرابط غير صحيح أو تغيّر مكان الصفحة." action={<Link href="/" className="button button-dark">العودة إلى حور</Link>} /></div>;
}
