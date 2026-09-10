#!/usr/bin/env node
// Drop TS2307 ("Cannot find module") signatures for dependencies that are declared in
// TherrMobile/package.json but are not installed on this machine.
//
// WHY THIS EXISTS
//
// `react-native-background-geolocation` is a licensed package: it will not install without
// credentials. On a machine that lacks them it is absent from node_modules, and tsc then
// reports TS2307 for every file importing it — errors that are not in the committed baseline,
// because CI installs the package successfully and never sees them. Left in, they read as new
// regressions on work that never touched mobile, and the tempting "fix" is
// `check-mobile-tsc-baseline.sh --update`, which silently erases the entire gate.
//
// WHAT IT DOES NOT DO
//
// It does not suppress missing modules generally. A signature is dropped only when all three
// hold:
//
//   1. The specifier is bare — not './x' or '/x', so a broken relative import still gates.
//   2. The package is declared in TherrMobile/package.json (dependencies or devDependencies),
//      so an import of a package nobody ever added still gates.
//   3. The package genuinely does not resolve on disk, under either TherrMobile/node_modules
//      or the root node_modules.
//
// Deleting a dependency from package.json while leaving its imports behind fails (2). A
// typo'd module name fails (2). In CI, where the install succeeds, (3) is false for every
// declared package and this filter is a no-op.
//
// Used as a CLI it reads signatures on stdin (one `<file>\t<TS code>\t<message>` per line) and
// writes the survivors to stdout; diagnostics go to stderr so they cannot contaminate the
// signature stream. `filterSignatures` is exported separately so the decision logic can be
// tested without touching the filesystem.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Matches the module name tsc quotes, e.g.
//   Cannot find module 'react-native-background-geolocation' or its corresponding type...
// Several quote characters are accepted because tsc has used both ' and ’ across versions.
const MISSING_MODULE_MESSAGE = /^Cannot find module ['"‘’]([^'"‘’]+)['"‘’]/;

/**
 * Partition signature lines into the ones that still count and the module names that were
 * excused. Pure — all filesystem knowledge arrives through `declaredDependencies` and
 * `isInstalled`.
 */
const filterSignatures = (lines, { declaredDependencies, isInstalled }) => {
    const excused = new Set();

    const kept = lines.filter((line) => {
        if (!line) {
            return false;
        }

        const [, code, message = ''] = line.split('\t');
        if (code !== 'TS2307') {
            return true;
        }

        const match = message.match(MISSING_MODULE_MESSAGE);
        if (!match) {
            return true;
        }

        const moduleName = match[1];
        const isBareSpecifier = !moduleName.startsWith('.') && !moduleName.startsWith('/');

        if (isBareSpecifier && declaredDependencies.has(moduleName) && !isInstalled(moduleName)) {
            excused.add(moduleName);
            return false;
        }

        return true;
    });

    return { kept, excused: [...excused].sort() };
};

const readDeclaredDependencies = () => {
    try {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'TherrMobile', 'package.json'), 'utf8'),
        );

        return new Set([
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.devDependencies || {}),
        ]);
    } catch (err) {
        // A missing or malformed package.json is not this script's problem to report. Fall
        // back to an empty set, which filters nothing and leaves the gate as it was.
        process.stderr.write(`   (dependency filter skipped: ${err.message})\n`);
        return new Set();
    }
};

const isInstalledOnDisk = (moduleName) => [
    path.join(REPO_ROOT, 'TherrMobile', 'node_modules', moduleName),
    path.join(REPO_ROOT, 'node_modules', moduleName),
].some((candidate) => fs.existsSync(candidate));

if (require.main === module) {
    const input = fs.readFileSync(0, 'utf8');
    const { kept, excused } = filterSignatures(input.split('\n'), {
        declaredDependencies: readDeclaredDependencies(),
        isInstalled: isInstalledOnDisk,
    });

    if (excused.length) {
        process.stderr.write(
            `   Ignoring "cannot find module" errors for declared-but-uninstalled package(s): ${
                excused.join(', ')
            }\n   (install them to type-check those imports; CI installs them and does check.)\n`,
        );
    }

    process.stdout.write(kept.length ? `${kept.join('\n')}\n` : '');
}

module.exports = { filterSignatures };
