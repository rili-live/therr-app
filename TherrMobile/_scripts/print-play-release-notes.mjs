#!/usr/bin/env node
/**
 * Print the Google Play "What's new" (release notes) for the Android build being cut, as a
 * block a human can copy straight into the Play Console.
 *
 * ## Why this does not write to Play itself
 *
 * It used to. `populate-play-release-notes.mjs` authenticated as a Play service account, polled
 * the release track until the versionCode EAS Submit had uploaded showed up, then attached the
 * notes to that release and committed the edit. It was a race it kept losing: EAS Submit is
 * asynchronous and the upload regularly landed on the track well after the poll window closed
 * (and after CircleCI's own no-output timeout had killed the step), so the notes were never
 * written and the only signal was a failed step at the end of a job whose build had actually
 * succeeded. Widening the window only made a broken run take longer to report.
 *
 * So the timing dependency is gone rather than tuned. This script reads the same files, resolves
 * the same versionCode, and prints the result. Nothing to authenticate, nothing to wait for, no
 * network at all — which also means it can run *before* the build instead of after it, so the
 * notes are in the log even when the build step later times out. Setting them on the release is
 * a manual paste in the Play Console; see `fastlane/metadata/android/README.md`.
 *
 * Release-notes text lives in the Fastlane `supply` metadata layout:
 *   fastlane/metadata/android/<play-locale>/changelogs/<versionCode>.txt
 *   fastlane/metadata/android/<play-locale>/changelogs/default.txt   (fallback)
 *
 * Zero runtime dependencies — uses only Node built-ins so it can run in CI without an
 * `npm install`.
 *
 * Usage:
 *   node _scripts/print-play-release-notes.mjs [options]
 * Options (all optional; defaults derived from the repo):
 *   --package <id>        Android applicationId (default: from app.json)
 *   --version-code <n>    versionCode to label the notes with (default: from build.gradle)
 *
 * Exit codes:
 *   0  notes printed (also when there are none to print — that is a warning, not a failure)
 *   1  a locale's notes exceed Google Play's 500-character limit, so they cannot be pasted
 *      as-is. Deliberately fatal, and deliberately before the build rather than after it.
 */
/* eslint-env node */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.resolve(__dirname, '..');
const METADATA_DIR = path.join(MOBILE_ROOT, 'fastlane', 'metadata', 'android');

const PLAY_NOTES_MAX = 500; // Google Play hard limit per language
const RULE = '='.repeat(72);

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        args[arg.slice(2)] = argv[i + 1];
        i += 1;
    }
    return args;
}

function log(msg) {
    console.log(`[play-release-notes] ${msg}`);
}

function warn(msg) {
    console.warn(`[play-release-notes] WARNING: ${msg}`);
}

// The copy/paste block itself is printed unprefixed: whatever the person selects out of the
// CircleCI log is exactly what belongs in the Play Console field, with no log noise to strip.
function out(msg = '') {
    console.log(msg);
}

function readPackageName() {
    try {
        const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, 'app.json'), 'utf8'));
        return appJson?.expo?.android?.package || null;
    } catch {
        return null;
    }
}

function readGradleVersions() {
    let gradle;
    try {
        gradle = fs.readFileSync(path.join(MOBILE_ROOT, 'android', 'app', 'build.gradle'), 'utf8');
    } catch {
        return {};
    }
    const code = gradle.match(/versionCode\s+(\d+)/);
    const name = gradle.match(/versionName\s+"([^"]+)"/);
    return {
        versionCode: code ? Number(code[1]) : undefined,
        versionName: name ? name[1] : undefined,
    };
}

/**
 * Collect release notes keyed by Play locale from the metadata directory.
 * Prefers `<versionCode>.txt`, falls back to `default.txt`.
 */
function collectReleaseNotes(versionCode) {
    if (!fs.existsSync(METADATA_DIR)) {
        return [];
    }
    const locales = fs
        .readdirSync(METADATA_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    const notes = [];
    for (const locale of locales) {
        const changelogsDir = path.join(METADATA_DIR, locale, 'changelogs');
        if (!fs.existsSync(changelogsDir)) continue;
        const versioned = path.join(changelogsDir, `${versionCode}.txt`);
        const fallback = path.join(changelogsDir, 'default.txt');
        const file = fs.existsSync(versioned) ? versioned : (fs.existsSync(fallback) ? fallback : null);
        if (!file) continue;
        const text = fs.readFileSync(file, 'utf8').trim();
        if (!text) continue;
        notes.push({
            language: locale,
            text,
            source: path.relative(MOBILE_ROOT, file),
            isVersioned: file === versioned,
        });
    }
    return notes;
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    const packageName = args.package || readPackageName() || '(unknown package)';
    const gradle = readGradleVersions();
    const versionCode = Number(args['version-code'] || gradle.versionCode);
    if (!versionCode) {
        throw new Error('Could not determine versionCode (pass --version-code).');
    }

    const notes = collectReleaseNotes(versionCode);
    if (notes.length === 0) {
        warn(
            `No release-notes files found under ${path.relative(MOBILE_ROOT, METADATA_DIR)} for `
            + `versionCode ${versionCode}. Google Play will show the previous release's notes.`,
        );
        return 0;
    }

    const overLimit = notes.filter((note) => note.text.length > PLAY_NOTES_MAX);

    log(`${packageName} — versionCode ${versionCode}${gradle.versionName ? ` (v${gradle.versionName})` : ''}.`);
    log(`Release notes resolved for: ${notes.map((n) => n.language).join(', ')}.`);
    log('These are NOT set on the release automatically. Paste them into the Play Console:');
    log('  Play Console > Release > Releases overview > the release > Edit > "What\'s new in this release"');

    out();
    out(RULE);
    out(`COPY/PASTE — Google Play release notes for versionCode ${versionCode}`);
    out(RULE);
    for (const note of notes) {
        out();
        out(`--- ${note.language} (${note.text.length}/${PLAY_NOTES_MAX} chars, from ${note.source}${
            note.isVersioned ? '' : ' — shared default'
        }) ---`);
        out(note.text);
    }
    out();
    out(RULE);
    out();

    if (overLimit.length) {
        for (const note of overLimit) {
            warn(
                `"${note.language}" is ${note.text.length} chars, over the Google Play limit of `
                + `${PLAY_NOTES_MAX}. Trim ${note.source}.`,
            );
        }
        return 1;
    }

    // Nudged here rather than only in the docs: this is the moment someone is looking at the
    // notes, and the versioned file is what keeps an older release's notes from being rewritten
    // by a later edit to the shared default.
    const usingDefault = notes.filter((note) => !note.isVersioned);
    if (usingDefault.length === notes.length) {
        log(
            `All locales fell back to default.txt. To pin notes to this build, copy each to `
            + `changelogs/${versionCode}.txt and tailor it.`,
        );
    }

    return 0;
}

try {
    process.exitCode = main();
} catch (err) {
    console.error(`[play-release-notes] ERROR: ${err.message}`);
    process.exitCode = 1;
}
