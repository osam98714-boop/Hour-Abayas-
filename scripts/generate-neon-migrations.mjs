import { spawnSync } from "node:child_process";

// drizzle-kit generate reads the schema and never connects to this placeholder.
// Supplying a safe PostgreSQL-shaped URL keeps an ambient Manus MySQL URL unused.
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "drizzle-kit", "generate"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder",
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
