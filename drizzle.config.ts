import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const isLocalDb = dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  },
});
