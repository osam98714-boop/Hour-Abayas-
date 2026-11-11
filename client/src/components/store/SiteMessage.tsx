import type { ReactNode } from "react";

export default function SiteMessage({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="site-message"><span className="site-message-monogram">ح</span><h1>{title}</h1><p>{message}</p>{action && <div className="site-message-action">{action}</div>}</div>;
}
