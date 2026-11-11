import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, VERCEL_BUILD: "1" },
});
if (result.error) throw result.error;
const exitCode = result.status ?? 1;
if (exitCode !== 0) process.exit(exitCode);
await rm(new URL("../public/__manus__", import.meta.url), { recursive: true, force: true });
