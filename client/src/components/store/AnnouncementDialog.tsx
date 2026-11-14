import { ArrowUpLeft, X } from "lucide-react";
import { useEffect } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type Announcement = NonNullable<inferRouterOutputs<AppRouter>["store"]["announcements"]["active"]>;

export default function AnnouncementDialog({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="announcement-overlay" onMouseDown={onClose}>
      <section className="announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-title" aria-describedby="announcement-message" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="announcement-close" onClick={onClose} aria-label="إغلاق الإعلان"><X size={19} /></button>
        {announcement.imageUrl && <img className="announcement-image" src={announcement.imageUrl} alt="" />}
        <div className="announcement-copy">
          <span className="eyebrow">من حور إليكِ</span>
          <h2 id="announcement-title">{announcement.title}</h2>
          <p id="announcement-message">{announcement.message}</p>
          {announcement.linkUrl && announcement.linkLabel && <a className="button button-dark" href={announcement.linkUrl} target="_blank" rel="noopener noreferrer">{announcement.linkLabel}<ArrowUpLeft size={15} /></a>}
        </div>
      </section>
    </div>
  );
}
