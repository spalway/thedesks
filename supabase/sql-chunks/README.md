# Database setup — paste these into the Supabase SQL Editor

Run **part-01 through part-08, in order**, one at a time. Wait for each to finish
before starting the next.

Then run `../RUN-THIS-SECOND.sql` (protocol_config).

## Why there are eight files

The full bundle is 1,031 kB and the SQL Editor rejects a request that size
("Query is too large to be run via the SQL Editor"). These are the same SQL,
split so no part exceeds ~147 kB.

The split is not arbitrary. It happens only at **statement boundaries**, and the
splitter tracks dollar-quoted function bodies (`$$ ... $$`), string literals and
comments so a semicolon inside one of those is never mistaken for the end of a
statement. Several of these migrations define plpgsql functions full of internal
semicolons; a naive split on `;` would produce files that each look valid and
are collectively broken.

Two seeds are a single `INSERT` with thousands of rows and no statement boundary
inside them at all — the xployee seed alone is 498 kB. Those were divided by
splitting the **value list** into several INSERTs of the same shape, which is
equivalent because the rows are independent.

Verified after generation: **13,434 value tuples in the source, 13,434 across the
eight parts.**

## If a part fails

Stop. Do not run the remaining parts — later ones depend on tables earlier ones
create.

Every part carries `-- SECTION n of 16 — <original migration>` banners, so the
error can be traced back to the migration it came from. Send that banner and the
error text.

## Re-running is safe

Every statement uses `if not exists`, `or replace`, or `on conflict do nothing`.
Running a part twice does not duplicate rows or error.

## Regenerating

If the migrations change:

```bash
npm run sql:split
```

That rebuilds these files from `../RUN-THIS-FIRST.sql` and re-checks the tuple
count. It refuses to divide any statement it cannot divide safely, leaving it
whole instead — so a part slightly over target means "this one statement could
not be split", not "the splitter gave up".

## Using the CLI instead

None of this is necessary with the Supabase CLI, which streams the migrations
directly and has no request-size limit:

```bash
npx supabase db push
```
