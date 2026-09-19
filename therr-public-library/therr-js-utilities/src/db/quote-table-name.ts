/**
 * Quote a schema-qualified table name for raw SQL: `main.leaderboardPeriodResults` →
 * `main."leaderboardPeriodResults"`.
 *
 * Knex's query builder quotes identifiers for us. Raw SQL does not, and Postgres folds any
 * unquoted identifier to lowercase — so a camelCase table name interpolated bare into
 * `knex.raw` looks up `main.leaderboardperiodresults`, which never exists, and every call
 * fails with `relation "…" does not exist` (prod, 2026-09-19). snake_case names only survive
 * because folding is a no-op on them. Wrapping every interpolated table name in this makes the
 * raw SQL match the case the migration created regardless of naming style, and
 * `therr/no-unquoted-camelcase-table-in-raw-sql` enforces its use for any name the lint rule
 * cannot prove is lowercase.
 *
 * An already-quoted table part is returned unchanged.
 */
const quoteTableName = (qualified: string): string => {
    const separator = qualified.indexOf('.');
    if (separator < 0) {
        return qualified.startsWith('"') ? qualified : `"${qualified}"`;
    }
    const schema = qualified.slice(0, separator);
    const table = qualified.slice(separator + 1);
    return table.startsWith('"') ? qualified : `${schema}."${table}"`;
};

export default quoteTableName;
