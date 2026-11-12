import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const buildEnv = { ...process.env, VERCEL_BUILD: "1" };

function run(args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: buildEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
run([
  "exec",
  "esbuild",
  "server/vercel-entry.ts",
  "--bundle",
  "--platform=node",
  "--packages=external",
  "--format=esm",
  "--target=node20",
  "--outfile=dist/vercel-entry.js",
]);
run(["exec", "vite", "build"]);
await rm(new URL("../public/__manus__", import.meta.url), { recursive: true, force: true });
