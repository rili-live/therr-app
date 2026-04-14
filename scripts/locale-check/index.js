#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Locale dictionary consistency check.
 *
 * Phase 1: key-parity — for each configured package, every non-base locale must
 * have exactly the same deep key paths as the base locale. Missing keys are
 * errors (fail build); extra keys are warnings (report, do not fail).
 *
 * Zero runtime dependencies (Node builtins only) so this can run in CI before
 * `install:all` completes.
 *
 * Usage:
 *   node scripts/locale-check/index.js
 *   node scripts/locale-check/index.js --target=therr-client-web
 *   node scripts/locale-check/index.js --verbose
 *   node scripts/locale-check/index.js --warn-as-error
 *
 * Exit codes:
 *   0 — all targets pass
 *   1 — at least one target has missing keys in a non-base locale
 *   2 — configuration error (bad target config, missing files, etc.)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'package-targets.json');

function parseArgs(argv) {
    const args = { target: null, verbose: false, warnAsError: false };
    for (const arg of argv.slice(2)) {
        if (arg === '--verbose' || arg === '-v') {
            args.verbose = true;
        } else if (arg === '--warn-as-error') {
            args.warnAsError = true;
        } else if (arg.startsWith('--target=')) {
            args.target = arg.slice('--target='.length);
        } else if (arg === '--help' || arg === '-h') {
            console.log(fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8'));
            process.exit(0);
        } else {
            console.error(`Unknown argument: ${arg}`);
            process.exit(2);
        }
    }
    return args;
}

function loadConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.targets)) {
            throw new Error('config.targets must be an array');
        }
        return parsed;
    } catch (err) {
        console.error(`[locale-check] Failed to load config ${CONFIG_PATH}: ${err.message}`);
        process.exit(2);
    }
    return null;
}

function loadDictionary(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
    }
}

/**
 * Recursively walk a dictionary object and collect the set of leaf key paths.
 * A leaf is any value that is not a plain object. Arrays are treated as leaves
 * (we do not index into them); the dictionaries in this repo do not use arrays
 * as namespaces, so array element parity is intentionally out of scope.
 */
function collectKeyPaths(value, prefix, acc) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        acc.add(prefix);
        return;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) {
        // Empty object — record the path itself so structural parity is preserved.
        acc.add(prefix);
        return;
    }
    for (const key of keys) {
        const nextPrefix = prefix === '' ? key : `${prefix}.${key}`;
        collectKeyPaths(value[key], nextPrefix, acc);
    }
}

function diffKeySets(baseKeys, otherKeys) {
    const missing = [];
    const extra = [];
    for (const key of baseKeys) {
        if (!otherKeys.has(key)) missing.push(key);
    }
    for (const key of otherKeys) {
        if (!baseKeys.has(key)) extra.push(key);
    }
    missing.sort();
    extra.sort();
    return { missing, extra };
}

function checkTarget(target, opts) {
    const result = {
        name: target.name,
        baseDir: target.baseDir,
        errors: [],
        warnings: [],
        stats: { baseKeyCount: 0, localesChecked: 0 },
    };

    const absBaseDir = path.join(REPO_ROOT, target.baseDir);
    if (!fs.existsSync(absBaseDir)) {
        result.errors.push(`baseDir does not exist: ${target.baseDir}`);
        return result;
    }

    const expectedLocales = target.expectedLocales || [];
    if (expectedLocales.length === 0) {
        result.errors.push('expectedLocales is empty — nothing to check');
        return result;
    }
    if (!expectedLocales.includes(target.baseLocale)) {
        result.errors.push(`baseLocale '${target.baseLocale}' not in expectedLocales`);
        return result;
    }

    // Load base locale
    const baseDictPath = path.join(absBaseDir, target.baseLocale, 'dictionary.json');
    if (!fs.existsSync(baseDictPath)) {
        result.errors.push(`Base dictionary not found: ${path.relative(REPO_ROOT, baseDictPath)}`);
        return result;
    }
    let baseDict;
    try {
        baseDict = loadDictionary(baseDictPath);
    } catch (err) {
        result.errors.push(err.message);
        return result;
    }
    const baseKeys = new Set();
    collectKeyPaths(baseDict, '', baseKeys);
    result.stats.baseKeyCount = baseKeys.size;

    // Check each non-base locale
    for (const locale of expectedLocales) {
        if (locale === target.baseLocale) continue;
        const localeDictPath = path.join(absBaseDir, locale, 'dictionary.json');
        if (!fs.existsSync(localeDictPath)) {
            result.errors.push(`Missing dictionary for locale '${locale}': ${path.relative(REPO_ROOT, localeDictPath)}`);
            continue;
        }
        let localeDict;
        try {
            localeDict = loadDictionary(localeDictPath);
        } catch (err) {
            result.errors.push(err.message);
            continue;
        }
        const localeKeys = new Set();
        collectKeyPaths(localeDict, '', localeKeys);
        const { missing, extra } = diffKeySets(baseKeys, localeKeys);
        result.stats.localesChecked += 1;

        if (missing.length > 0) {
            result.errors.push({
                kind: 'missing-keys',
                locale,
                count: missing.length,
                keys: missing,
            });
        }
        if (extra.length > 0) {
            result.warnings.push({
                kind: 'extra-keys',
                locale,
                count: extra.length,
                keys: extra,
            });
        }
    }

    // Warn on locales present on disk but not listed in expectedLocales —
    // likely a forgotten wiring-up step.
    try {
        const entries = fs.readdirSync(absBaseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (!expectedLocales.includes(entry.name)) {
                const localeDictPath = path.join(absBaseDir, entry.name, 'dictionary.json');
                if (fs.existsSync(localeDictPath)) {
                    result.warnings.push({
                        kind: 'unexpected-locale',
                        locale: entry.name,
                        detail: `Directory exists with dictionary.json but is not listed in expectedLocales. Add it to package-targets.json or remove the directory.`,
                    });
                }
            }
        }
    } catch {
        // non-fatal
    }

    return result;
}

function formatIssue(issue, opts) {
    if (typeof issue === 'string') return issue;
    if (issue.kind === 'missing-keys') {
        const preview = issue.keys.slice(0, opts.verbose ? issue.keys.length : 10);
        const truncated = !opts.verbose && issue.keys.length > 10 ? ` (+${issue.keys.length - 10} more — use --verbose)` : '';
        const keyList = preview.map((k) => `      - ${k}`).join('\n');
        return `Locale '${issue.locale}' is missing ${issue.count} key(s) present in base:\n${keyList}${truncated}`;
    }
    if (issue.kind === 'extra-keys') {
        const preview = issue.keys.slice(0, opts.verbose ? issue.keys.length : 10);
        const truncated = !opts.verbose && issue.keys.length > 10 ? ` (+${issue.keys.length - 10} more — use --verbose)` : '';
        const keyList = preview.map((k) => `      - ${k}`).join('\n');
        return `Locale '${issue.locale}' has ${issue.count} extra key(s) not in base:\n${keyList}${truncated}`;
    }
    if (issue.kind === 'unexpected-locale') {
        return `Locale directory '${issue.locale}' exists on disk but is not in expectedLocales. ${issue.detail}`;
    }
    return JSON.stringify(issue);
}

function run() {
    const args = parseArgs(process.argv);
    const config = loadConfig();
    const started = Date.now();

    const targets = args.target
        ? config.targets.filter((t) => t.name === args.target)
        : config.targets;

    if (args.target && targets.length === 0) {
        console.error(`[locale-check] No target named '${args.target}' in package-targets.json`);
        process.exit(2);
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    console.log(`[locale-check] Checking ${targets.length} package target(s)`);
    console.log('');

    for (const target of targets) {
        const result = checkTarget(target, args);
        const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
        const status = result.errors.length > 0 ? 'FAIL' : (result.warnings.length > 0 ? 'WARN' : 'OK  ');
        console.log(`  [${status}] ${result.name}  (${result.baseDir})`);
        if (args.verbose || hasIssues) {
            console.log(`         base keys: ${result.stats.baseKeyCount}, non-base locales checked: ${result.stats.localesChecked}`);
        }

        for (const err of result.errors) {
            console.log(`    ERROR: ${formatIssue(err, args)}`);
            totalErrors += 1;
        }
        for (const warn of result.warnings) {
            console.log(`    WARN:  ${formatIssue(warn, args)}`);
            totalWarnings += 1;
        }
        if (hasIssues) console.log('');
    }

    const elapsedMs = Date.now() - started;
    console.log('');
    console.log(`[locale-check] Done in ${elapsedMs}ms — ${totalErrors} error(s), ${totalWarnings} warning(s)`);

    if (totalErrors > 0) process.exit(1);
    if (args.warnAsError && totalWarnings > 0) process.exit(1);
    process.exit(0);
}

run();
