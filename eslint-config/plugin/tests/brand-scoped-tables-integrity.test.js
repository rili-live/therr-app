// Integrity checks on the BRAND_SCOPED_TABLES list itself.
//
// The list is data, not code, so nothing else verifies it describes reality. Two failure
// modes are silent without this:
//
//   1. A typo ('main.notification') produces a rule that matches nothing. Lint passes,
//      every direct reference to the real table stays legal, and the isolation guarantee
//      is quietly gone.
//   2. A table is added to the list without the BrandScopedStore subclass that is supposed
//      to be the sanctioned way to read it — so the rule forbids all access to a table with
//      no legal access path, or (worse) an override is added to silence it and no scoping
//      is applied anywhere.
//
// CLAUDE.md documents three things that must land together when a table becomes
// brand-scoped: the list entry, the store, and the per-store lint exemption. This asserts
// the first two; the third is only load-bearing if the second exists.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { BRAND_SCOPED_TABLES } = require('../../brand-scoped-tables');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVICES_DIR = path.join(REPO_ROOT, 'therr-services');

const collectStoreFiles = () => fs.readdirSync(SERVICES_DIR)
    .map((service) => path.join(SERVICES_DIR, service, 'src/store'))
    .filter((storeDir) => fs.existsSync(storeDir))
    .flatMap((storeDir) => fs.readdirSync(storeDir)
        .filter((entry) => entry.endsWith('Store.ts'))
        .map((entry) => {
            const full = path.join(storeDir, entry);
            return {
                relative: path.relative(REPO_ROOT, full),
                contents: fs.readFileSync(full, 'utf8'),
            };
        }));

const storeFiles = collectStoreFiles();

assert.ok(
    storeFiles.length > 0,
    `Found no *Store.ts files under ${SERVICES_DIR} — this test is not actually checking anything.`,
);

assert.ok(
    BRAND_SCOPED_TABLES.length > 0,
    'BRAND_SCOPED_TABLES is empty, which disables brand-scoping enforcement entirely. '
    + 'If that is intentional, delete this assertion deliberately.',
);

// Shape check first — catches 'notifications' or 'main .notifications' before the more
// confusing "no store found" message below.
const QUALIFIED_NAME = /^[a-z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_]*$/;

const checkTable = (table) => {
    if (!QUALIFIED_NAME.test(table)) {
        return `"${table}" is not a valid fully-qualified table name (expected <schema>.<table>).`;
    }

    const referencing = storeFiles.filter((file) => file.contents.includes(`'${table}'`)
        || file.contents.includes(`"${table}"`));

    if (referencing.length === 0) {
        return `"${table}" is in BRAND_SCOPED_TABLES but no *Store.ts references it. `
            + 'Either the name is a typo (the lint rule then matches nothing and the table '
            + 'is silently unprotected), or the BrandScopedStore subclass was never written.';
    }

    const scoped = referencing.filter((file) => /extends\s+BrandScopedStore/.test(file.contents));

    if (scoped.length === 0) {
        return `"${table}" is referenced by ${referencing.map((f) => f.relative).join(', ')}, `
            + 'but none of those extend BrandScopedStore. Reads of a brand-scoped table must '
            + 'route through a BrandScopedStore subclass so the brandVariation predicate is applied.';
    }

    return null;
};

const failures = BRAND_SCOPED_TABLES.map(checkTable).filter(Boolean);

assert.deepStrictEqual(
    failures,
    [],
    `\nBrand-scoped table integrity failures:\n  - ${failures.join('\n  - ')}\n`,
);

console.log(
    `brand-scoped-tables-integrity: ${BRAND_SCOPED_TABLES.length} table(s) verified `
    + `against ${storeFiles.length} store file(s)`,
);
