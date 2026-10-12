import { neon, types } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// By default the driver parses a Postgres DATE column into a JS Date object,
// but Patch.due_date is declared (and consumed) as an ISO "YYYY-MM-DD" string —
// e.g. DueDateChip does `dueDate.slice(0, 10)`, which throws on a Date. The
// driver reads from pg's global type-parser registry, so override the DATE
// parser to return the raw wire text ("YYYY-MM-DD") and match the declared type.
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (val: string) => val);

// TIMESTAMPTZ columns would otherwise arrive as Date objects while every type
// in lib/queries.ts says `string` — so string methods typechecked and then
// crashed at runtime (completed_at.localeCompare took down /insights). Parse
// with pg's default parser, then normalize to an ISO string: types become
// true, Safari can parse it client-side, and JSON/MCP output is unchanged
// since Dates already serialized to the same ISO string.
const TIMESTAMPTZ_OID = 1184;
const parseTimestamptz = types.getTypeParser(TIMESTAMPTZ_OID);
types.setTypeParser(TIMESTAMPTZ_OID, (val: string) =>
  (parseTimestamptz(val) as Date).toISOString()
);

export const sql = neon(process.env.DATABASE_URL);
