#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Locale dictionary consistency check.
 *
 * Phase 1: key-parity — for each configured package, every non-base locale must
 * have exactly the same deep key paths as the base locale. Missing keys are
 * errors (fail build); extra keys are warnings (report, do not fail).
 *
 * Phase 2: referenced-key existence — every key passed to translate() in the package's
 * `srcDir` must resolve to a string in the base dictionary. Phase 1 cannot catch this:
 * a key absent from ALL locales is perfectly in parity. It still ships broken, because
 * `configureTranslator` returns the key path itself on a miss, so the user reads
 * "errorMessages.habitGoals.nameRequired" where a sentence belongs. Pre-existing misses
 * are exempted by referenced-keys-baseline.json, which is a one-way ratchet.
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
const BASELINE_PATH = path.join(__dirname, 'referenced-keys-baseline.json');

/**
 * Matches `translate('a.b.c'` and `translate(locale, 'a.b.c'` — the two call shapes in this
 * repo (frontends bind the locale up front, services pass it per call). Deliberately narrow:
 * a key assembled at runtime cannot be checked statically, and guessing which other string
 * literals are dictionary paths produces false positives that make the gate untrustworthy.
 */
const TRANSLATE_CALL = /\btranslate\s*\(\s*(?:[^,()'"]+,\s*)?['"]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"]/g;
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

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

function loadBaseline() {
    try {
        return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).keys || {};
    } catch (err) {
        console.error(`[locale-check] Failed to load baseline ${BASELINE_PATH}: ${err.message}`);
        process.exit(2);
    }
    return {};
}

function collectSourceFiles(absDir, acc) {
    let entries;
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const entry of entries) {
        const full = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
            // `locales/` holds the dictionaries themselves; node_modules is not ours to check.
            if (entry.name === 'node_modules' || entry.name === 'locales') continue;
            collectSourceFiles(full, acc);
        } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
            acc.push(full);
        }
    }
    return acc;
}

/** Resolves a dotted path against a dictionary, returning the leaf only when it is a string. */
function resolveLeafString(dict, keyPath) {
    let cursor = dict;
    for (const segment of keyPath.split('.')) {
        if (cursor === null || typeof cursor !== 'object' || !(segment in cursor)) return null;
        cursor = cursor[segment];
    }
    return typeof cursor === 'string' ? cursor : null;
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

/**
 * Phase 2 — every translate() key in the package's source must resolve to a string in the base
 * dictionary. Misses listed in referenced-keys-baseline.json are tolerated; a baseline entry that
 * now resolves is reported as a warning so the ratchet cannot accumulate dead weight.
 */
function checkReferencedKeys(target, baseDict, result, opts) {
    if (!target.srcDir) {
        result.warnings.push({
            kind: 'no-src-dir',
            detail: 'Target has no "srcDir", so referenced keys were not checked. Add one to package-targets.json.',
        });
        return;
    }

    const absSrcDir = path.join(REPO_ROOT, target.srcDir);
    if (!fs.existsSync(absSrcDir)) {
        result.errors.push(`srcDir does not exist: ${target.srcDir}`);
        return;
    }

    const exempt = new Set((opts.baseline && opts.baseline[target.name]) || []);
    const referenced = new Set();
    for (const file of collectSourceFiles(absSrcDir, [])) {
        const contents = fs.readFileSync(file, 'utf8');
        TRANSLATE_CALL.lastIndex = 0;
        let match = TRANSLATE_CALL.exec(contents);
        while (match !== null) {
            referenced.add(match[1]);
            match = TRANSLATE_CALL.exec(contents);
        }
    }

    const undefinedKeys = [];
    for (const key of referenced) {
        if (resolveLeafString(baseDict, key) === null && !exempt.has(key)) undefinedKeys.push(key);
    }
    undefinedKeys.sort();

    const resolvedBaselineKeys = [...exempt]
        .filter((key) => referenced.has(key) && resolveLeafString(baseDict, key) !== null)
        .sort();

    result.stats.referencedKeyCount = referenced.size;

    if (undefinedKeys.length > 0) {
        result.errors.push({
            kind: 'undefined-referenced-keys',
            count: undefinedKeys.length,
            keys: undefinedKeys,
        });
    }
    if (resolvedBaselineKeys.length > 0) {
        result.warnings.push({
            kind: 'stale-baseline-keys',
            count: resolvedBaselineKeys.length,
            keys: resolvedBaselineKeys,
        });
    }
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

    checkReferencedKeys(target, baseDict, result, opts);

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
    if (issue.kind === 'undefined-referenced-keys') {
        const preview = issue.keys.slice(0, opts.verbose ? issue.keys.length : 10);
        const truncated = !opts.verbose && issue.keys.length > 10 ? ` (+${issue.keys.length - 10} more — use --verbose)` : '';
        const keyList = preview.map((k) => `      - ${k}`).join('\n');
        return `${issue.count} key(s) passed to translate() are not defined in the base dictionary.\n`
            + `    The translator returns the key path itself on a miss, so these render as raw dotted\n`
            + `    strings in the UI. Define them in EVERY locale for this package:\n${keyList}${truncated}`;
    }
    if (issue.kind === 'stale-baseline-keys') {
        const keyList = issue.keys.map((k) => `      - ${k}`).join('\n');
        return `${issue.count} key(s) in referenced-keys-baseline.json now resolve. Delete them from\n`
            + `    scripts/locale-check/referenced-keys-baseline.json — the baseline only shrinks:\n${keyList}`;
    }
    if (issue.kind === 'no-src-dir') {
        return issue.detail;
    }
    if (issue.kind === 'unexpected-locale') {
        return `Locale directory '${issue.locale}' exists on disk but is not in expectedLocales. ${issue.detail}`;
    }
    return JSON.stringify(issue);
}

function run() {
    const args = parseArgs(process.argv);
    const config = loadConfig();
    args.baseline = loadBaseline();
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
