#!/usr/bin/env node
/**
 * Emit the top-level declaration barrels that webpack does not produce.
 *
 * Why this exists: the shared libraries are bundled by webpack, one entry per
 * public subpath. An entry whose source is `src/types/index.ts` is emitted as the
 * bundle `lib/types.js`, but ts-loader writes declarations mirroring the *source*
 * tree, so the types for that same entry land at `lib/types/index.d.ts`. Nothing
 * writes `lib/types.d.ts`.
 *
 * That gap is invisible to `moduleResolution: node`/`bundler` consumers that have
 * `allowJs: false` — TypeScript skips `lib/types.js` and falls through to the
 * directory's `index.d.ts`. But TherrMobile sets `allowJs: true` (it must; its
 * `include` list has `index.js`), so `lib/types.js` wins the extension race. The
 * minified UMD bundle carries no named exports, so every import from
 * `therr-react/types` fails with TS2305 "has no exported member" rather than the
 * TS2307 you would expect from a genuinely missing module.
 *
 * It stayed hidden because `parts.clean()` in webpack.parts.js is called with no
 * arguments, which sets `cleanOnceBeforeBuildPatterns: []` — CleanWebpackPlugin
 * then deletes nothing. Long-lived working trees keep barrels emitted by an older
 * build, so `lib/` looks complete locally and is incomplete on a fresh CI checkout.
 *
 * Usage: node _bin/generate-declaration-barrels.js <lib-dir>
 */

const fs = require('fs');
const path = require('path');

const libDir = process.argv[2];

if (!libDir) {
    console.error('Usage: node _bin/generate-declaration-barrels.js <lib-dir>');
    process.exit(2);
}

const root = path.resolve(libDir);

if (!fs.existsSync(root)) {
    console.error(`No such directory: ${root}`);
    process.exit(2);
}

const written = [];

/**
 * `export *` deliberately omits the default export, so a barrel built from it alone
 * turns `import getCombinedReducers from 'therr-react/redux/reducers'` into a
 * namespace object — TS2349 "this expression is not callable" at every call site.
 * Re-export the default explicitly, but only where one exists: `export { default }`
 * against a module without one is itself an error.
 *
 * `export { default as Foo } from './Foo'` is a *named* re-export and does not give
 * the module a default, hence the negative lookahead on `as`.
 */
const hasDefaultExport = (declarationFile) => {
    const source = fs.readFileSync(declarationFile, 'utf8');

    return /^\s*export\s+default\b/m.test(source)
        || /export\s*\{[^}]*\bdefault\s*(?:,|\}|\s+as\s+default\b)/.test(source);
};

// A barrel is warranted only where all three hold: the directory publishes an
// `index.d.ts`, webpack emitted a sibling bundle for it, and no declaration
// already sits alongside that bundle. Anything else is either not a public entry
// or already resolves correctly.
const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }

        const subDir = path.join(dir, entry.name);
        const indexDeclaration = path.join(subDir, 'index.d.ts');

        if (fs.existsSync(indexDeclaration)
            && fs.existsSync(`${subDir}.js`)
            && !fs.existsSync(`${subDir}.d.ts`)) {
            let contents = `export * from './${entry.name}/index';\n`;

            if (hasDefaultExport(indexDeclaration)) {
                contents += `export { default } from './${entry.name}/index';\n`;
            }

            fs.writeFileSync(`${subDir}.d.ts`, contents);
            written.push(path.relative(root, `${subDir}.d.ts`));
        }

        walk(subDir);
    }
};

walk(root);

const label = path.relative(process.cwd(), root) || root;

if (written.length) {
    console.log(`Generated ${written.length} declaration barrel(s) in ${label}:`);
    written.sort().forEach((file) => console.log(`   ${file}`));
} else {
    console.log(`No declaration barrels needed in ${label}.`);
}
