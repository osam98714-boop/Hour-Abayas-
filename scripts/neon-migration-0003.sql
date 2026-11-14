-- حور | HOUR ABAYAS — ترحيل Neon رقم 0003
-- شغّلي هذا الملف في قاعدة Neon نفسها التي يستخدمها موقع Vercel:
-- المشروع hour-abayas-db، الفرع production، قاعدة neondb.
-- يضيف عمودي الإحداثيات وجدول الإعلانات والفهرس فقط؛ ولا يحذف بيانات المتجر أو يستبدلها.
-- صُمم ليكون قابلًا لإعادة التشغيل إذا انقطع الاتصال بعد نجاح المعاملة.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'جدول public.orders غير موجود. اختاري قاعدة Neon المستخدمة للموقع المنشور.';
  END IF;
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'سجل Drizzle غير موجود. تحققي من اختيار قاعدة المتجر الأصلية.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.store_announcements (
  id serial PRIMARY KEY NOT NULL,
  title varchar(140) NOT NULL,
  message text NOT NULL,
  image_url text,
  link_label varchar(60),
  link_url text,
  active boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS store_announcements_active_updated_idx
  ON public.store_announcements USING btree (active, updated_at);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT
  'f032038acb78a36eb09726e8f51e2245ad61a71f4b50cf3eb0b8a5e5d3e5502e',
  1794652336094
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = 'f032038acb78a36eb09726e8f51e2245ad61a71f4b50cf3eb0b8a5e5d3e5502e'
);

COMMIT;
