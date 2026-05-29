import { neon, types } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// By default the driver parses a Postgres DATE column into a JS Date object,
// but Patch.due_date is declared (and consumed) as an ISO "YYYY-MM-DD" string —
// e.g. DueDateChip does `dueDate.slice(0, 10)`, which throws on a Date. The
// driver reads from pg's global type-parser registry, so override the DATE
// parser to return the raw wire text ("YYYY-MM-DD") and match the declared type.
// (Timestamp columns stay as Date objects; every consumer wraps them in
// `new Date(...)`, and pg's timestamptz text isn't reliably parseable in Safari.)
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (val: string) => val);

export const sql = neon(process.env.DATABASE_URL);
