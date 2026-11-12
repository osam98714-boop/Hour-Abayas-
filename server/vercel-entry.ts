import type { Request, Response } from "express";
import { createApp } from "./_core/app";
import { restoreVercelApiRequestUrl } from "./_core/vercelApiPath";

const app = createApp();

export default function handler(req: Request, res: Response) {
  try {
    req.url = restoreVercelApiRequestUrl(req.url ?? "/");
  } catch {
    res.status(400).json({ error: "مسار API غير صالح." });
    return;
  }

  return app(req, res);
}
