import express from "express";
import path from "node:path";
import { createApp } from "./server/_core/app";

const app = createApp();
const indexPath = path.resolve(process.cwd(), "public", "index.html");

// Vercel serves files under public/** from its CDN. Requests for client-side
// routes reach this function and reuse the built SPA document.
app.get("/404", (_req, res) => {
  res.status(404).sendFile(indexPath);
});
app.get("*", (req, res) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    res.status(404).json({ error: "المسار غير موجود." });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(404).end();
    return;
  }
  res.sendFile(indexPath, (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  console.error("[Vercel Express] Unhandled error:", error instanceof Error ? error.name : "unknown");
  res.status(500).json({ error: "حدث خطأ غير متوقع." });
});

export default app;
