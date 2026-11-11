import { spawnSync } from "node:child_process";

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  console.error("Migration stopped: configure a PostgreSQL NEON_DATABASE_URL first.");
  process.exit(1);
}
if (process.env.CONFIRM_NEON_MIGRATIONS !== "1") {
  console.error("Migration stopped: set CONFIRM_NEON_MIGRATIONS=1 after checking the target Neon database.");
  process.exit(1);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: { ...process.env, NEON_DATABASE_URL: databaseUrl },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
