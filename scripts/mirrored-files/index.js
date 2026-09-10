#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Mirrored-file drift check.
 *
 * A few modules are deliberately duplicated across packages rather than abstracted into
 * `therr-js-utilities` — usually because they own per-process mutable state that must NOT be
 * shared between services. Duplication is the right call there, but nothing enforced that the
 * copies stayed in step, so a bug fixed in one copy silently survived in the other.
 *
 * This compares each configured group line-by-line and fails on the first difference,
 * ignoring only the lines a target explicitly whitelists (e.g. a comment naming the sibling
 * service, which is legitimately different in each copy).
 *
 * Zero runtime dependencies (Node builtins only) so it can run in CI before `npm ci`.
 *
 * Usage:
 *   node scripts/mirrored-files/index.js
 *   node scripts/mirrored-files/index.js --target=incrementInterestEngagement
 *   node scripts/mirrored-files/index.js --verbose
 *
 * Exit codes:
 *   0 — every group is in sync
 *   1 — at least one group has drifted
 *   2 — configuration error (missing file, malformed config)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'mirror-targets.json');

function parseArgs(argv) {
    const args = { target: null, verbose: false };
    for (const arg of argv.slice(2)) {
        if (arg === '--verbose' || arg === '-v') {
            args.verbose = true;
        } else if (arg.startsWith('--target=')) {
            args.target = arg.slice('--target='.length);
        } else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/mirrored-files/index.js [--target=<name>] [--verbose]');
            process.exit(0);
        } else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(2);
        }
    }
    return args;
}

/**
 * Blank out the lines a target chose to ignore rather than dropping them, so reported line
 * numbers still point at the real line in the file.
 */
function readComparableLines(relativePath, ignorePatterns) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`✖ Configured mirror file does not exist: ${relativePath}`);
        process.exit(2);
    }

    return fs.readFileSync(absolutePath, 'utf8')
        .split('\n')
        .map((line) => (ignorePatterns.some((pattern) => pattern.test(line)) ? null : line));
}

function firstDifference(baseLines, otherLines) {
    const length = Math.max(baseLines.length, otherLines.length);
    for (let i = 0; i < length; i += 1) {
        const base = baseLines[i];
        const other = otherLines[i];
        // `null` marks an ignored line; a line is only ignorable if BOTH copies opted out of it,
        // otherwise an ignore pattern could mask a real deletion in one copy.
        if (base === null && other === null) {
            continue; // eslint-disable-line no-continue
        }
        if (base !== other) {
            return { lineNumber: i + 1, base, other };
        }
    }
    return null;
}

function checkTarget(target, verbose) {
    if (!Array.isArray(target.files) || target.files.length < 2) {
        console.error(`✖ Mirror target "${target.name}" must list at least two files.`);
        process.exit(2);
    }

    const ignorePatterns = (target.ignoreLinesMatching || []).map((source) => new RegExp(source));
    const [basePath, ...otherPaths] = target.files;
    const baseLines = readComparableLines(basePath, ignorePatterns);

    let failed = false;

    for (const otherPath of otherPaths) {
        const otherLines = readComparableLines(otherPath, ignorePatterns);
        const difference = firstDifference(baseLines, otherLines);

        if (!difference) {
            if (verbose) {
                console.log(`  ✓ ${otherPath} matches ${basePath}`);
            }
            continue; // eslint-disable-line no-continue
        }

        failed = true;
        console.error(`\n✖ Mirrored files have drifted (target: ${target.name})`);
        console.error(`    ${basePath}:${difference.lineNumber}`);
        console.error(`      ${difference.base === null ? '<ignored line>' : difference.base}`);
        console.error(`    ${otherPath}:${difference.lineNumber}`);
        console.error(`      ${difference.other === null ? '<ignored line>' : difference.other}`);
        if (target.reason) {
            console.error(`\n    Why these are duplicated: ${target.reason}`);
        }
        console.error('\n    Apply the change to every copy, or drop the file from'
            + ' scripts/mirrored-files/mirror-targets.json if they are meant to diverge now.');
    }

    return !failed;
}

function main() {
    const args = parseArgs(process.argv);

    let config;
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
        console.error(`✖ Could not read ${CONFIG_PATH}: ${err.message}`);
        process.exit(2);
    }

    const targets = (config.targets || []).filter((target) => !args.target || target.name === args.target);

    if (!targets.length) {
        console.error(args.target
            ? `✖ No mirror target named "${args.target}".`
            : '✖ No mirror targets configured.');
        process.exit(2);
    }

    const results = targets.map((target) => {
        if (args.verbose) {
            console.log(`Checking mirror target: ${target.name}`);
        }
        return checkTarget(target, args.verbose);
    });

    if (results.some((passed) => !passed)) {
        process.exit(1);
    }

    console.log(`✓ Mirrored files in sync (${targets.length} target${targets.length === 1 ? '' : 's'})`);
}

main();
