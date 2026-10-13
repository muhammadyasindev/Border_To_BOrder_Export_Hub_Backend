import fs from "fs";
import path from "path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

const globalForDb = globalThis as typeof globalThis & {
  __borderglowDb?: any;
  __borderglowClient?: any;
  __borderglowPool?: Pool;
  __borderglowInitPromise?: Promise<void>;
};

const databaseUrl = process.env.DATABASE_URL;
const isExplicitPostgres =
  process.env.USE_POSTGRES === "true" ||
  (databaseUrl &&
    !databaseUrl.includes("127.0.0.1:5432") &&
    !databaseUrl.includes("localhost:5432") &&
    (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")));

let dbInstance: any;

if (isExplicitPostgres) {
  const isLocalDb = databaseUrl ? (databaseUrl.includes("127.0.0.1") || databaseUrl.includes("localhost")) : true;
  const pool =
    globalForDb.__borderglowPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: isLocalDb ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client:", err.message);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__borderglowPool = pool;
  }

  dbInstance = drizzlePg(pool);
} else {
  // Use persistent embedded PostgreSQL (PGlite)
  const dataDir = path.resolve(process.cwd(), "data", "pgdata");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!globalForDb.__borderglowClient) {
    const pidFile = path.join(dataDir, "postmaster.pid");
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch (e) {}
    }
    const client = new PGlite(dataDir);
    globalForDb.__borderglowClient = client;
    globalForDb.__borderglowDb = drizzlePglite(client);

    const initMarker = path.join(dataDir, ".initialized");
    globalForDb.__borderglowInitPromise = client.waitReady.then(async () => {
      if (!fs.existsSync(initMarker)) {
        try {
          const migrationFile = path.resolve(process.cwd(), "drizzle", "0000_smart_lady_ursula.sql");
          if (fs.existsSync(migrationFile)) {
            const sql = fs.readFileSync(migrationFile, "utf-8");
            await client.exec(sql);
            fs.writeFileSync(initMarker, new Date().toISOString(), "utf-8");
            console.log("BorderGlow database tables initialized successfully in PGlite.");
          }
        } catch (err: any) {
          console.error("Migration init error:", err);
        }
      }

      try {
        await client.exec(`
          ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_role" text;
          ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" text;
          ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "voice_duration" numeric;
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp;
          CREATE TABLE IF NOT EXISTS "password_resets" (
            "id" serial PRIMARY KEY,
            "email" text NOT NULL,
            "otp_hash" text NOT NULL,
            "attempts" integer DEFAULT 0 NOT NULL,
            "expires_at" timestamp NOT NULL,
            "used_at" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL
          );
          CREATE TABLE IF NOT EXISTS "email_verifications" (
            "id" serial PRIMARY KEY,
            "email" text NOT NULL,
            "otp_hash" text NOT NULL,
            "attempts" integer DEFAULT 0 NOT NULL,
            "expires_at" timestamp NOT NULL,
            "used_at" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL
          );
          CREATE TABLE IF NOT EXISTS "compliance_audit_logs" (
            "id" serial PRIMARY KEY,
            "admin_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
            "case_reference" text NOT NULL,
            "justification" text NOT NULL,
            "authorized_by" text NOT NULL,
            "action" text DEFAULT 'inspection_access' NOT NULL,
            "ip_address" text,
            "grant_token_hash" text NOT NULL,
            "expires_at" timestamp NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL
          );
        `);
      } catch (err: any) {
        console.warn("Schema patch error:", err);
      }
    }).catch((err: any) => {
      console.error("PGlite waitReady failed:", err);
    });
  }

  dbInstance = globalForDb.__borderglowDb;
}

export const db = dbInstance;
export const pool = globalForDb.__borderglowPool;
