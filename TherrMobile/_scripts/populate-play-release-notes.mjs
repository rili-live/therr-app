#!/usr/bin/env node
/**
 * Populate Google Play "What's new" (release notes) for the Android build that
 * EAS Submit just pushed.
 *
 * EAS Submit uploads the AAB but does NOT manage release notes, so we set them
 * ourselves via the Google Play Developer API (androidpublisher v3). This runs
 * after `eas build --auto-submit` in the `eas_build_therr_android` CircleCI job.
 *
 * Release-notes text lives in the Fastlane `supply` metadata layout:
 *   fastlane/metadata/android/<play-locale>/changelogs/<versionCode>.txt
 *   fastlane/metadata/android/<play-locale>/changelogs/default.txt   (fallback)
 *
 * Zero runtime dependencies — uses only Node built-ins (crypto, fs, global
 * fetch) so it can run in CI without an `npm install`.
 *
 * Credentials: a Google Play service-account JSON key, supplied via either
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON        (raw JSON string), or
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH   (path to the JSON file)
 * The account needs the "Release manager" permission on the Play listing.
 * If no credentials are present the script logs a warning and exits 0 so it
 * never breaks the pipeline for forks/contributors without the secret.
 *
 * Usage:
 *   node _scripts/populate-play-release-notes.mjs [options]
 * Options (all optional; sensible defaults derived from the repo):
 *   --package <id>          Android applicationId (default: from app.json)
 *   --track <name>          Play track (default: internal, matches eas.json)
 *   --version-code <n>      versionCode to annotate (default: from build.gradle)
 *   --timeout-ms <n>        How long to wait for the release to appear (default: 900000)
 *   --poll-interval-ms <n>  Poll interval while waiting (default: 30000)
 *   --changes-not-sent-for-review <bool>  Commit flag (default: true, matches eas.json)
 *   --dry-run               Resolve notes + release, but don't write to Play
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.resolve(__dirname, '..');
const METADATA_DIR = path.join(MOBILE_ROOT, 'fastlane', 'metadata', 'android');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PLAY_NOTES_MAX = 500; // Google Play hard limit per language

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        if (key === 'dry-run') {
            args[key] = true;
            continue;
        }
        args[key] = argv[i + 1];
        i += 1;
    }
    return args;
}

function log(msg) {
    // eslint-disable-next-line no-console
    console.log(`[play-release-notes] ${msg}`);
}

function warn(msg) {
    // eslint-disable-next-line no-console
    console.warn(`[play-release-notes] WARNING: ${msg}`);
}

function loadServiceAccount() {
    const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    const filePath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH;
    let json;
    if (raw && raw.trim()) {
        json = raw;
    } else if (filePath && fs.existsSync(filePath)) {
        json = fs.readFileSync(filePath, 'utf8');
    } else {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(json);
    } catch (err) {
        throw new Error(`Service-account JSON is not valid JSON: ${err.message}`);
    }
    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service-account JSON is missing client_email / private_key.');
    }
    return parsed;
}

function readPackageName() {
    try {
        const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, 'app.json'), 'utf8'));
        return appJson?.expo?.android?.package || null;
    } catch {
        return null;
    }
}

function readVersionCode() {
    const gradle = fs.readFileSync(
        path.join(MOBILE_ROOT, 'android', 'app', 'build.gradle'),
        'utf8',
    );
    const match = gradle.match(/versionCode\s+(\d+)/);
    if (!match) {
        throw new Error('Could not find versionCode in android/app/build.gradle');
    }
    return Number(match[1]);
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
        .map((entry) => entry.name);

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
        if (text.length > PLAY_NOTES_MAX) {
            throw new Error(
                `Release notes for "${locale}" are ${text.length} chars, exceeding the `
                + `Google Play limit of ${PLAY_NOTES_MAX}. Trim ${path.relative(MOBILE_ROOT, file)}.`,
            );
        }
        notes.push({ language: locale, text });
    }
    return notes;
}

function base64url(input) {
    return Buffer.from(input).toString('base64url');
}

async function getAccessToken(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64url(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    }));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const signature = signer.sign(serviceAccount.private_key, 'base64url');
    const assertion = `${header}.${claim}.${signature}`;

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });
    const body = await res.json();
    if (!res.ok) {
        throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
    }
    return body.access_token;
}

function apiFactory(accessToken, packageName) {
    return async function api(method, endpoint, { query, body } = {}) {
        const url = new URL(`${API_BASE}/applications/${encodeURIComponent(packageName)}${endpoint}`);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
            }
        }
        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!res.ok) {
            throw new Error(`${method} ${endpoint} failed (${res.status}): ${text}`);
        }
        return parsed;
    };
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
        warn(
            'No Google Play service-account credentials found '
            + '(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH). '
            + 'Skipping release-notes population.',
        );
        return;
    }

    const packageName = args.package || readPackageName();
    if (!packageName) {
        throw new Error('Could not determine Android package name (pass --package).');
    }
    const track = args.track || 'internal';
    const versionCode = Number(args['version-code'] || readVersionCode());
    const timeoutMs = Number(args['timeout-ms'] || 900000);
    const pollIntervalMs = Number(args['poll-interval-ms'] || 30000);
    const changesNotSentForReview = args['changes-not-sent-for-review']
        ? args['changes-not-sent-for-review'] !== 'false'
        : true;

    const notes = collectReleaseNotes(versionCode);
    if (notes.length === 0) {
        warn(`No release-notes files found under ${path.relative(MOBILE_ROOT, METADATA_DIR)}. Nothing to do.`);
        return;
    }
    log(`Package ${packageName}, track "${track}", versionCode ${versionCode}.`);
    log(`Release notes for: ${notes.map((n) => n.language).join(', ')}.`);

    if (args['dry-run']) {
        log('Dry run — not writing to Google Play. Resolved notes:');
        for (const note of notes) {
            log(`  [${note.language}] ${note.text.replace(/\n/g, ' ↵ ')}`);
        }
        return;
    }

    const accessToken = await getAccessToken(serviceAccount);
    const api = apiFactory(accessToken, packageName);

    // EAS Submit runs asynchronously; poll until the release with our
    // versionCode shows up on the track, then attach the notes and commit.
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;
    for (;;) {
        attempt += 1;
        const edit = await api('POST', '/edits');
        const editId = edit.id;
        try {
            const trackData = await api('GET', `/edits/${editId}/tracks/${encodeURIComponent(track)}`);
            const releases = trackData.releases || [];
            const target = releases.find((rel) => (rel.versionCodes || []).map(String).includes(String(versionCode)));

            if (target) {
                target.releaseNotes = notes;
                await api('PUT', `/edits/${editId}/tracks/${encodeURIComponent(track)}`, {
                    body: { track, releases },
                });
                await api('POST', `/edits/${editId}:commit`, {
                    query: { changesNotSentForReview },
                });
                log(`Release notes committed to the "${track}" track for versionCode ${versionCode}.`);
                return;
            }

            // Not there yet — abandon this edit and wait before retrying.
            await api('DELETE', `/edits/${editId}`).catch(() => {});
            if (Date.now() >= deadline) {
                throw new Error(
                    `versionCode ${versionCode} never appeared on the "${track}" track within `
                    + `${Math.round(timeoutMs / 1000)}s. Is EAS Submit still running or did it fail?`,
                );
            }
            log(`versionCode ${versionCode} not on track yet (attempt ${attempt}); retrying in ${Math.round(pollIntervalMs / 1000)}s…`);
            await sleep(pollIntervalMs);
        } catch (err) {
            // Abandon the edit on any hard error so we don't leak open edits.
            await api('DELETE', `/edits/${editId}`).catch(() => {});
            throw err;
        }
    }
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[play-release-notes] ERROR: ${err.message}`);
    process.exit(1);
});
