# ChaosPatch — Tags Feature Spec

**Feature:** Add free-form tags to patches for filtering and search  
**Project:** ChaosPatch MCP Server  
**Status:** Ready to implement

---

## Goal

Add a `tags` field to patches so Nae can filter and search across projects by tag (e.g. `bug`, `ui`, `db`). Tags are free-form strings — no enforced enum, no tag management endpoint. Keep it simple.

---

## Schema Change

### Migration

Add a `tags` column to the `patches` table:

```sql
ALTER TABLE patches
ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
```

- Type: `text[]` (Postgres array)
- Default: empty array (not null)
- No FK constraints — free text is intentional

### Drizzle Schema Update

```ts
tags: text('tags').array().notNull().default([]),
```

---

## Tool Changes

### 1. `cp_add_patch`

Add optional `tags` parameter.

```ts
// New param
tags?: string[]  // default: []
```

Insert tags alongside other fields. No validation needed — pass through as-is.

---

### 2. `cp_update_patch`

Add optional `tags` parameter. **Replaces** the existing tags array entirely (not append).

```ts
// New param
tags?: string[]  // if omitted, leave existing tags unchanged
```

If `tags` is provided (even as `[]`), overwrite. If absent, skip the field in the update.

---

### 3. `cp_list_patches`

Add optional `tags` filter. Match behavior: **any** (patch has at least one of the provided tags).

```ts
// New param
tags?: string[]  // if provided, return patches where tags && input_tags (array overlap)
```

SQL filter to add when `tags` is provided:

```sql
WHERE tags && ARRAY[...input_tags]
```

---

### 4. `cp_list_all_patches`

Same tags filter as `cp_list_patches` — apply at the query level before returning results.

```ts
// New param
tags?: string[]
```

---

### 5. `cp_search_patches`

Extend existing text search to also match against tags.

```sql
-- Current (approximate)
WHERE title ILIKE %query% OR notes ILIKE %query%

-- Updated
WHERE title ILIKE %query%
   OR notes ILIKE %query%
   OR EXISTS (
     SELECT 1 FROM unnest(tags) t WHERE t ILIKE %query%
   )
```

---

## Response Shape

All patch responses should include `tags` in the returned object. If currently omitted, add it:

```ts
{
  id: string,
  title: string,
  status: string,
  priority: string,
  tags: string[],   // ← add this
  notes: string | null,
  // ...etc
}
```

---

## Suggested Tag Conventions

These are just conventions — nothing is enforced in the DB or tool layer.

| Tag | Use for |
|---|---|
| `bug` | Something broken |
| `feature` | New functionality |
| `ui` | Visual / component work |
| `ux` | Interaction / flow work |
| `api` | Endpoint or external API changes |
| `db` | Schema, migrations, query changes |
| `mcp` | MCP tool changes |
| `auth` | Auth / permissions / Clerk |
| `perf` | Performance improvements |
| `dx` | Developer experience / tooling |

---

## Out of Scope (for now)

- Tag autocomplete or suggestion endpoint
- Enforced tag enum / validation
- Tag rename / merge tooling
- Tag counts or analytics
- `tags` filter on `cp_search_patches` (text search covers it)

---

## Implementation Order

1. Write and run migration
2. Update Drizzle schema
3. Update `cp_add_patch`
4. Update `cp_update_patch`
5. Update `cp_list_patches`
6. Update `cp_list_all_patches`
7. Update `cp_search_patches`
8. Verify all responses include `tags` field
9. Smoke test: add a tagged patch, filter by tag, search by tag
