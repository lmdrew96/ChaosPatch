/**
 * One-time migration: creates the mcp_tokens table.
 * Run with: npx tsx lib/migrate.ts
 */
import { neon } from "@neondatabase/serverless";

// tsx auto-loads .env.local — no manual dotenv import needed

const sql = neon(process.env.DATABASE_URL!);

void (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS mcp_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log("Done: mcp_tokens table ready.");
})();
