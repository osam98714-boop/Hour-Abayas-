import { Pool } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../drizzle/schema";
import type { InsertUser } from "../drizzle/schema";

function postgresConnectionString(): string | null {
  const explicitNeonUrl = process.env.NEON_DATABASE_URL?.trim();
  if (explicitNeonUrl && /^postgres(?:ql)?:\/\//i.test(explicitNeonUrl)) return explicitNeonUrl;

  // Neon injects DATABASE_URL on Vercel. The URI check deliberately rejects the
  // MySQL DATABASE_URL in the Manus development environment.
  const vercelDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (vercelDatabaseUrl && /^postgres(?:ql)?:\/\//i.test(vercelDatabaseUrl)) return vercelDatabaseUrl;
  return null;
}

let pool: Pool | undefined;
let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase(connectionString: string) {
  pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10_000,
  });
  return drizzle({ client: pool, schema });
}

/** Returns null when external Neon resources are not connected; never falls back to Manus MySQL. */
export function getDb() {
  const connectionString = postgresConnectionString();
  if (!connectionString) return null;
  if (!database) database = createDatabase(connectionString);
  return database;
}

export function isPostgresDatabaseConfigured() {
  return postgresConnectionString() !== null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("OAuth openId is required");
  const db = getDb();
  if (!db) throw new Error("Neon PostgreSQL is not configured");

  const now = new Date();
  const configuredOwnerId = process.env.OWNER_OPEN_ID?.trim();
  const shouldBeAdmin = Boolean(configuredOwnerId && user.openId === configuredOwnerId);
  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: shouldBeAdmin ? "admin" : "user",
    lastSignedIn: user.lastSignedIn ?? now,
    updatedAt: now,
  };

  await db
    .insert(schema.users)
    .values(values)
    .onConflictDoUpdate({
      target: schema.users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        updatedAt: now,
        role: values.role,
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) return undefined;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.openId, openId)).limit(1);
  return user;
}

export async function updateUserLastSignedIn(openId: string) {
  const db = getDb();
  if (!db) throw new Error("Neon PostgreSQL is not configured");
  const now = new Date();
  await db.update(schema.users).set({ lastSignedIn: now, updatedAt: now }).where(and(eq(schema.users.openId, openId)));
}

export async function closeDatabasePoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
  database = undefined;
}
