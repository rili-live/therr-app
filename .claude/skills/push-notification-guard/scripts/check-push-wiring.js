#!/usr/bin/env node
/*
 * Push-notification wiring checker.
 *
 * Cross-references the places a notification type has to be registered in order
 * to actually reach a handset and route on tap. Every check here corresponds to
 * a failure that has already shipped to production, and every one of them fails
 * silently at runtime — see `.claude/skills/push-notification-guard/SKILL.md`.
 *
 * Regex-based on purpose: it must run against the *other* branch's files too
 * (`git show niche/HABITS-general:<path>`), which are not compilable from here.
 *
 * Usage:
 *   node .claude/skills/push-notification-guard/scripts/check-push-wiring.js
 *   node ... --brand-branch niche/HABITS-general   # read mobile files from that branch
 *   node ... --json
 *
 * Exit code 1 if any BLOCKER fired, 0 otherwise. Warnings never fail the run.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../../..');

const P = {
    pushEnums: 'therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts',
    branding: 'therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts',
    firebaseAdmin: 'therr-services/push-notifications-service/src/api/firebaseAdmin.ts',
    checkinNudgeCopy: 'therr-services/push-notifications-service/src/api/checkinNudgeCopy.ts',
    manifest: 'TherrMobile/android/app/src/main/AndroidManifest.xml',
    buildGradle: 'TherrMobile/android/app/build.gradle',
    mobileConstants: 'TherrMobile/main/constants/index.tsx',
    layout: 'TherrMobile/main/components/Layout.tsx',
    pbxproj: 'TherrMobile/ios/Therr.xcodeproj/project.pbxproj',
    locales: (l) => `therr-services/push-notifications-service/src/locales/${l}/dictionary.json`,
};

const LOCALES = ['en-us', 'es', 'fr-ca'];

// Brands whose `AndroidIntentActions` key differs from a naive capitalization of
// the enum value, plus the brands that deliberately ship no app of their own and
// therefore ride Therr's identity.
const BRANDS_WITHOUT_OWN_APP = new Set(['appy-social', 'parallels', 'otaku', 'dashboard-therr']);

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const brandBranchIdx = args.indexOf('--brand-branch');
const brandBranch = brandBranchIdx >= 0 ? args[brandBranchIdx + 1] : null;

const findings = [];
const add = (level, id, title, detail, fix) => findings.push({
    level, id, title, detail, fix,
});
const blocker = (...a) => add('BLOCKER', ...a);
const warn = (...a) => add('WARN', ...a);
const info = (...a) => add('INFO', ...a);

// ---------------------------------------------------------------------------
// File access. Mobile files may be read from another branch, because the native
// half of push wiring (AndroidManifest, build.gradle) lives on `niche/*` and the
// shared half lives on `general` — a type is only wired once BOTH have shipped.
// ---------------------------------------------------------------------------
const MOBILE_PREFIX = 'TherrMobile/';

const readFile = (rel) => {
    const useBranch = brandBranch && rel.startsWith(MOBILE_PREFIX);
    if (useBranch) {
        try {
            return execFileSync('git', ['show', `${brandBranch}:${rel}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        } catch (e) {
            return null;
        }
    }
    const abs = path.join(REPO, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
};

const required = (rel) => {
    const c = readFile(rel);
    if (c === null) {
        blocker('missing-file', `Cannot read ${rel}`,
            brandBranch && rel.startsWith(MOBILE_PREFIX)
                ? `Not present on ${brandBranch}.`
                : 'File not found — the checker\'s paths need updating.',
            'Fix the path in check-push-wiring.js, or pass a branch that has the file.');
    }
    return c;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const enumBlock = (src, name) => {
    const m = src.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
    return m ? m[1] : null;
};

/** `KEY = 'value',` pairs inside an enum body. */
const enumEntries = (body) => {
    const out = new Map();
    for (const m of body.matchAll(/^\s*(\w+)\s*=\s*'([^']*)'/gm)) out.set(m[1], m[2]);
    return out;
};

/** Members of a `new Set([... PushNotifications.Types.x ...])` assigned to `name`. */
const typeSet = (src, name) => {
    const m = src.match(new RegExp(`${name}[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`));
    if (!m) return null;
    return new Set([...m[1].matchAll(/PushNotifications\.Types\.(\w+)/g)].map((x) => x[1]));
};

const pushEnumsSrc = required(P.pushEnums);
const brandingSrc = required(P.branding);
const firebaseSrc = required(P.firebaseAdmin);
if (!pushEnumsSrc || !brandingSrc || !firebaseSrc) {
    report();
    process.exit(1);
}

const notifTypes = enumEntries(enumBlock(pushEnumsSrc, 'Types') || '');
const brandVariations = enumEntries(enumBlock(brandingSrc, 'BrandVariations') || '');

// The `IntentActionKey` union — the declared contract every brand enum must meet.
const intentUnionMatch = pushEnumsSrc.match(/export type IntentActionKey =([\s\S]*?);\n/);
const intentUnionKeys = intentUnionMatch
    ? new Set([...intentUnionMatch[1].matchAll(/'([A-Z_0-9]+)'/g)].map((m) => m[1]))
    : new Set();

// `AndroidIntentActions` map: brand label -> enum name.
const intentMapMatch = pushEnumsSrc.match(/export const AndroidIntentActions\s*=\s*\{([\s\S]*?)\};/);
const intentMap = new Map();
if (intentMapMatch) {
    for (const m of intentMapMatch[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) intentMap.set(m[1], m[2]);
}

const brandIntentEnums = new Map(); // label -> Map(KEY -> 'action.string')
for (const [label, enumName] of intentMap) {
    const body = enumBlock(pushEnumsSrc, enumName);
    if (!body) {
        blocker('intent-enum-missing', `AndroidIntentActions.${label} points at a missing enum`,
            `\`${enumName}\` is referenced by the AndroidIntentActions map but not declared in ${P.pushEnums}.`,
            'Declare the enum, or drop the map entry.');
        continue;
    }
    brandIntentEnums.set(label, enumEntries(body));
}

const createMessageCases = new Set([...firebaseSrc.matchAll(/case PushNotifications\.Types\.(\w+)/g)].map((m) => m[1]));

/**
 * Per-type facts read out of createMessage: which builder the case uses, the
 * intent-action key it stamps, and (for display types) the channel it names.
 * The distinction matters — a data-only push is rendered by Notifee on the
 * device, a display push is rendered by the OS with no JS involved, and they
 * fail in different places.
 */
const caseFacts = new Map();
{
    const marker = /case PushNotifications\.Types\.(\w+)\s*:/g;
    const hits = [...firebaseSrc.matchAll(marker)];
    hits.forEach((m, i) => {
        const body = firebaseSrc.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : firebaseSrc.length);
        const clickKeys = [...body.matchAll(/getAppBrandingClickAction\([^,]+,\s*'([A-Z_0-9]+)'\)/g)].map((x) => x[1]);
        const chans = [...body.matchAll(/channelId:\s*AndroidChannelId\.(\w+)/g)].map((x) => x[1]);
        caseFacts.set(m[1], {
            dataOnly: /createDataOnlyMessage\(/.test(body),
            display: /createNotificationMessage\(/.test(body),
            clickKeys,
            channels: chans,
        });
    });
}

/**
 * Intent key -> the first Types member that stamps it. Several types can share
 * one key (the habit-lifecycle cases all reuse STREAK_MILESTONE), so this is
 * "who sends this key", not a bijection.
 */
const keyToType = new Map();
for (const [type, facts] of caseFacts) for (const k of facts.clickKeys) if (!keyToType.has(k)) keyToType.set(k, type);

/** Types this brand must never receive, from the server's own two exclusion lists. */
const habitsOnly = typeSet(firebaseSrc, 'HABITS_ONLY_TYPES') || new Set();
const brandExcluded = new Map();
{
    const blk = firebaseSrc.match(/const BRAND_EXCLUDED_NOTIFICATION_TYPES[\s\S]*?\n\};/);
    if (blk) {
        for (const m of blk[0].matchAll(/BrandVariations\.(\w+)\]:\s*new Set\(\[([\s\S]*?)\]\)/g)) {
            brandExcluded.set(m[1], new Set([...m[2].matchAll(/PushNotifications\.Types\.(\w+)/g)].map((x) => x[1])));
        }
    }
}

/** Brand label (AndroidIntentActions key) -> BrandVariations member name. */
const labelToBrandMember = new Map();
for (const label of intentMap.keys()) {
    const member = [...brandVariations.keys()].find((b) => b.replace(/_/g, '').toLowerCase() === label.toLowerCase());
    if (member) labelToBrandMember.set(label, member);
}

/** Would this brand ever legitimately receive this type? */
const brandCanReceive = (label, type) => {
    if (!type) return true;
    const member = labelToBrandMember.get(label);
    if (habitsOnly.has(type) && member !== 'HABITS') return false;
    if (member && brandExcluded.get(member)?.has(type)) return false;
    return true;
};

// ---------------------------------------------------------------------------
// A1 — Every brand's intent-action enum covers the same keys
//
// A key present for one brand and absent for another is a tap that routes on
// Therr and dead-ends on the niche app (or vice versa). Nothing reports it:
// `getAppBrandingClickAction` returns `undefined`, FCM accepts the message, and
// the notification arrives with no action.
// ---------------------------------------------------------------------------
{
    const allKeys = new Set([...intentUnionKeys]);
    for (const keys of brandIntentEnums.values()) for (const k of keys.keys()) allKeys.add(k);

    for (const [label, keys] of brandIntentEnums) {
        // A key is only *required* for a brand that can actually receive the
        // type behind it. HABITS-only keys absent from Therr/Teem are correct,
        // and the server already refuses to send them there.
        const missing = [...allKeys]
            .filter((k) => !keys.has(k))
            .filter((k) => brandCanReceive(label, keyToType.get(k)))
            .sort();
        if (missing.length) {
            const sendableMissing = missing.filter((k) => keyToType.has(k));
            const level = sendableMissing.length ? blocker : warn;
            level('intent-key-gap', `AndroidIntentActions.${label} is missing ${missing.length} intent-action key(s) it can receive`,
                missing.map((k) => (keyToType.has(k) ? `${k} (sent as ${keyToType.get(k)})` : `${k} (no sender)`)).join(', '),
                `Add each key to \`${intentMap.get(label)}\` in ${P.pushEnums}. `
                + 'Without it `getAppBrandingClickAction` returns undefined and the notification arrives with no tap action. '
                + 'If the type genuinely does not belong to this brand, add it to HABITS_ONLY_TYPES / '
                + 'BRAND_EXCLUDED_NOTIFICATION_TYPES instead, so the server refuses to send it rather than sending it inert.');
        }

        // A key the enum has but the union does not: `getAppBrandingClickAction`
        // is typed on the union, so this is unreachable from createMessage.
        const extra = [...keys.keys()].filter((k) => !intentUnionKeys.has(k)).sort();
        if (extra.length) {
            warn('intent-key-not-in-union', `AndroidIntentActions.${label} declares ${extra.length} key(s) missing from IntentActionKey`,
                extra.join(', '),
                `Add them to the \`IntentActionKey\` union in ${P.pushEnums} so createMessage can reference them.`);
        }
    }

    // Prefixes must be distinct per brand — two brands sharing a prefix means a
    // tap on one app can be claimed by the other when both are installed.
    const prefixes = new Map();
    for (const [label, keys] of brandIntentEnums) {
        const sample = [...keys.values()][0] || '';
        const prefix = sample.slice(0, sample.lastIndexOf('.'));
        if (!prefix) continue;
        if (prefixes.has(prefix)) {
            blocker('intent-prefix-collision', `Brands "${prefixes.get(prefix)}" and "${label}" share the intent-action prefix "${prefix}"`,
                'Both apps declare the same intent filters, so Android may route a tap to either one when both are installed.',
                'Give each brand a prefix derived from its own applicationId.');
        }
        prefixes.set(prefix, label);
    }
}

// Which brand's binary the TherrMobile files under review build. Resolved in A2.
let mobileBrandLabel = null;

// ---------------------------------------------------------------------------
// A2 — AndroidManifest declares every intent action the server may send
//
// Android silently no-ops a tap whose action string the manifest does not
// declare. The manifest lives on the *brand's own branch*; the enum lives on
// `general`. That split is why this drifts.
// ---------------------------------------------------------------------------
{
    const manifest = readFile(P.manifest);
    const gradle = readFile(P.buildGradle);
    if (!manifest) {
        warn('manifest-unreadable', `Could not read ${P.manifest}`,
            brandBranch ? `Not present on ${brandBranch}.` : 'Skipping the manifest cross-check.', '');
    } else {
        // Resolve `${notificationActionPrefix}` from the build.gradle map, when
        // the branch uses the placeholder form.
        const declared = new Set();
        for (const m of manifest.matchAll(/<action android:name="([^"]+)"/g)) declared.add(m[1]);

        const prefixes = new Set();
        for (const a of declared) {
            if (a.startsWith('android.intent.')) continue;
            if (a.includes('${')) {
                const g = gradle || '';
                for (const pm of g.matchAll(/notificationActionPrefixByAppId[\s\S]*?\]/g)) {
                    for (const s of pm[0].matchAll(/'([\w.]+)'\s*\]?\s*$/gm)) prefixes.add(s[1]);
                }
                for (const pm of g.matchAll(/notificationActionPrefix\s*:\s*[\s\S]{0,200}?getOrDefault\([^,]*,\s*'([\w.]+)'/g)) prefixes.add(pm[1]);
                for (const pm of g.matchAll(/\(([\w.]+)\)\s*:\s*'([\w.]+)'/g)) prefixes.add(pm[2]);
            } else {
                prefixes.add(a.slice(0, a.lastIndexOf('.')));
            }
        }

        const usesPlaceholder = [...declared].some((a) => a.includes('${'));

        // Which brand do these mobile files build? Read applicationId from
        // build.gradle and push it through the same prefix map the manifest
        // placeholder uses. Needed below: the client's channel buckets only have
        // to cover the types the brand this binary belongs to can receive.
        if (gradle) {
            const appIdMatch = gradle.match(/applicationId\s+"([\w.]+)"/);
            const appId = appIdMatch ? appIdMatch[1] : null;
            const prefixMap = new Map();
            const mapBlock = gradle.match(/notificationActionPrefixByAppId\s*=\s*\[([\s\S]*?)\]/);
            if (mapBlock) for (const m of mapBlock[1].matchAll(/'([\w.]+)'\s*:\s*'([\w.]+)'/g)) prefixMap.set(m[1], m[2]);
            const prefix = (appId && prefixMap.get(appId)) || 'app.therrmobile';
            for (const [label, keys] of brandIntentEnums) {
                const sample = [...keys.values()][0] || '';
                if (sample.slice(0, sample.lastIndexOf('.')) === prefix) mobileBrandLabel = label;
            }
        }
        const declaredKeys = new Set();
        for (const a of declared) {
            if (a.startsWith('android.intent.')) continue;
            declaredKeys.add(a.slice(a.lastIndexOf('.') + 1));
        }

        // Which brand enum does this manifest correspond to? Match on prefix,
        // and fall back to "whichever brand's keys it most resembles".
        let matchedLabel = null;
        for (const [label, keys] of brandIntentEnums) {
            const sample = [...keys.values()][0] || '';
            const prefix = sample.slice(0, sample.lastIndexOf('.'));
            if (prefixes.has(prefix)) { matchedLabel = label; break; }
        }
        // A placeholder manifest (`${notificationActionPrefix}.KEY`) carries no
        // brand of its own, so the prefix cannot identify it. `applicationId` in
        // build.gradle can, and it is what the placeholder resolves through — a
        // manifest is only responsible for the brand its own tree builds. The
        // Habits filters live on niche/HABITS-general, not here.
        if (usesPlaceholder) matchedLabel = mobileBrandLabel;

        const labelsToCheck = matchedLabel ? [matchedLabel] : [...brandIntentEnums.keys()];
        const buildsBrand = matchedLabel ? `builds brand: ${matchedLabel}` : 'brand unidentified — checked against every brand enum';
        // A placeholder manifest is one file serving every brand, so a gap in it
        // is one gap, not one per brand. Collapse them.
        const live = new Map();   // KEY -> brands affected
        const latent = new Map();
        for (const label of labelsToCheck) {
            const keys = brandIntentEnums.get(label);
            for (const k of keys.keys()) {
                if (declaredKeys.has(k)) continue;
                if (!brandCanReceive(label, keyToType.get(k))) continue;
                const bucket = keyToType.has(k) ? live : latent;
                bucket.set(k, [...(bucket.get(k) || []), label]);
            }
        }
        const describe = (m) => [...m.entries()].sort()
            .map(([k, labels]) => `${k}${keyToType.has(k) ? ` (sent as ${keyToType.get(k)})` : ''}`
                + (labelsToCheck.length > 1 ? ` — brand(s): ${labels.join(', ')}` : ''))
            .join('\n  ');
        const provenance = `manifest read from: ${brandBranch || 'working tree'} (${buildsBrand})`;
        if (live.size) {
            blocker('manifest-action-gap',
                `AndroidManifest.xml is missing ${live.size} intent-filter action(s) the server actually sends`,
                `${describe(live)}\n  ${provenance}`,
                `Add an <intent-filter> block per action to ${P.manifest} on the branch that builds the brand. `
                + 'Android silently no-ops a tap whose action string the manifest does not declare — the notification '
                + 'shows, the tap opens nothing, and no error is produced anywhere.');
        }
        if (latent.size) {
            info('manifest-action-latent',
                `AndroidManifest.xml is missing ${latent.size} declared-but-unsent action(s)`,
                `${describe(latent)}\n  ${provenance}`,
                'Harmless today (no createMessage case stamps them). Add the intent-filter in the same change that '
                + 'adds a sender, or the first notification of that type will be untappable.');
        }
    }
}

// ---------------------------------------------------------------------------
// A3 — createMessage cases and SENDABLE_NOTIFICATION_TYPES agree
//
// A type with a case but no whitelist entry is built and then dropped
// (`notification-type-not-routed`). A whitelist entry with no case is rejected
// as `unsupported-notification-type`.
// ---------------------------------------------------------------------------
{
    const sendable = typeSet(firebaseSrc, 'SENDABLE_NOTIFICATION_TYPES');
    if (!sendable) {
        blocker('sendable-unparsed', 'Could not parse SENDABLE_NOTIFICATION_TYPES', 'The declaration shape changed.', 'Update the regex in this checker.');
    } else {
        const caseNoSend = [...createMessageCases].filter((t) => !sendable.has(t)).sort();
        const sendNoCase = [...sendable].filter((t) => !createMessageCases.has(t)).sort();
        if (caseNoSend.length) {
            blocker('type-built-not-sent', `${caseNoSend.length} type(s) have a createMessage case but are not in SENDABLE_NOTIFICATION_TYPES`,
                caseNoSend.join(', '),
                `Add each to SENDABLE_NOTIFICATION_TYPES in ${P.firebaseAdmin}. They are built and then dropped today.`);
        }
        if (sendNoCase.length) {
            blocker('type-sendable-not-built', `${sendNoCase.length} type(s) are whitelisted but have no createMessage case`,
                sendNoCase.join(', '),
                `Add a case to createMessage in ${P.firebaseAdmin}, or remove the whitelist entry.`);
        }
    }

    // Types that exist in the enum but nothing can ever send.
    const orphan = [...notifTypes.keys()].filter((t) => !createMessageCases.has(t)).sort();
    if (orphan.length) {
        info('type-no-case', `${orphan.length} declared type(s) have no createMessage case`,
            orphan.join(', '),
            'Expected for types that are in-app-only or not yet built. Confirm none of these is one you just added.');
    }
}

// ---------------------------------------------------------------------------
// A4 — Every locale key createMessage translates exists in all three locales
//
// A missing key renders the key path as the notification body for that locale.
// ---------------------------------------------------------------------------
{
    const sources = [firebaseSrc, readFile(P.checkinNudgeCopy) || ''];
    const keys = new Set();
    for (const src of sources) {
        for (const m of src.matchAll(/'(notifications\.[\w.]+)'/g)) keys.add(m[1]);
    }
    const dicts = {};
    for (const l of LOCALES) {
        const raw = readFile(P.locales(l));
        if (!raw) { blocker('locale-missing', `Missing dictionary for ${l}`, P.locales(l), 'Create it.'); continue; }
        try { dicts[l] = JSON.parse(raw); } catch (e) { blocker('locale-unparseable', `${l} dictionary is not valid JSON`, e.message, 'Fix the JSON.'); }
    }
    const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    const gaps = [];
    for (const key of [...keys].sort()) {
        for (const l of LOCALES) {
            if (!dicts[l]) continue;
            // Keys ending in a partial path (built dynamically) resolve to an object — that's fine.
            if (lookup(dicts[l], key) === undefined) gaps.push(`${l}: ${key}`);
        }
    }
    if (gaps.length) {
        blocker('locale-key-gap', `${gaps.length} translate() key(s) are missing from a dictionary`,
            gaps.join('\n  '),
            'Add each key to every locale. A missing key renders the raw key path as the push body.');
    }
}

// ---------------------------------------------------------------------------
// A5 — Every brand has a BRAND_APP_IDENTITIES row, and its apns-topic is a
// bundle id an iOS target actually builds.
//
// APNS silently discards a push whose apns-topic is not the receiving app's own
// bundle id; FCM still returns a message id and the service still logs success.
// ---------------------------------------------------------------------------
{
    const identBlock = firebaseSrc.match(/const BRAND_APP_IDENTITIES[\s\S]*?\n\};/);
    if (!identBlock) {
        blocker('identities-unparsed', 'Could not parse BRAND_APP_IDENTITIES', 'The declaration shape changed.', 'Update the regex in this checker.');
    } else {
        const covered = new Set([...identBlock[0].matchAll(/BrandVariations\.(\w+)\]/g)].map((m) => m[1]));
        const uncovered = [...brandVariations.keys()].filter((b) => !covered.has(b));
        if (uncovered.length) {
            blocker('brand-identity-missing', `${uncovered.length} brand(s) have no BRAND_APP_IDENTITIES row`,
                uncovered.join(', '),
                `Add a row in ${P.firebaseAdmin}. (tsc catches this too — if it did not, the Record<> type was widened.)`);
        }
    }

    const pbx = readFile(P.pbxproj);
    if (pbx) {
        const built = new Set([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([\w.$()<>:]+)"?;/g)]
            .map((m) => m[1]).filter((id) => !id.includes('org.reactjs.native.example')));
        const topics = new Set([...firebaseSrc.matchAll(/iosApnsTopic:\s*'([\w.]+)'/g)].map((m) => m[1]));
        // THERR_IOS_BUNDLE_ID is referenced by constant, resolve it too.
        const constMatch = firebaseSrc.match(/const THERR_IOS_BUNDLE_ID\s*=\s*'([\w.]+)'/);
        if (constMatch) topics.add(constMatch[1]);
        const bad = [...topics].filter((t) => !built.has(t));
        if (bad.length) {
            blocker('apns-topic-unbuilt', `${bad.length} apns-topic value(s) are not built by any iOS target`,
                bad.join(', '),
                'APNS drops these pushes silently. Point the brand at the bundle id its iOS build actually uses, '
                + 'or add the iOS target in the same change.');
        }
    } else {
        info('pbxproj-skipped', 'Skipped the apns-topic check', `${P.pbxproj} not readable from this branch.`, '');
    }
}

// ---------------------------------------------------------------------------
// A6 — Mobile knows about every brand
//
// Layout.tsx picks the intent-action enum with a hardcoded chain. A brand it
// does not name falls through to Therr's action strings, which never match what
// that brand's binary receives — so every notification tap dead-ends.
// ---------------------------------------------------------------------------
{
    const layout = readFile(P.layout);
    if (layout) {
        const named = new Set([...layout.matchAll(/AndroidIntentActions\.(\w+)/g)].map((m) => m[1]));
        const shipping = [...brandIntentEnums.keys()].filter((l) => !named.has(l));
        if (shipping.length) {
            blocker('layout-brand-unrouted', `${shipping.length} brand(s) are not named in Layout.tsx's intent-action selection`,
                shipping.join(', '),
                `Add a branch in ${P.layout}. A brand that falls through to Therr's enum never matches its own `
                + 'action strings, so every notification tap silently opens nothing.');
        }
    }

    const constants = readFile(P.mobileConstants);
    if (constants && firebaseSrc) {
        const serverChannels = new Set([...(firebaseSrc.match(/enum AndroidChannelId\s*\{[\s\S]*?\n\}/) || [''])[0]
            .matchAll(/(\w+)\s*=\s*'(\w+)'/g)].map((m) => m[2]));
        const mobileChannels = new Set([...(constants.match(/enum AndroidChannelIds\s*\{[\s\S]*?\n\}/) || [''])[0]
            .matchAll(/(\w+)\s*=\s*'(\w+)'/g)].map((m) => m[2]));
        const missing = [...serverChannels].filter((c) => !mobileChannels.has(c));
        if (missing.length) {
            blocker('channel-not-on-device', `${missing.length} server channelId(s) are not declared on the mobile client`,
                missing.join(', '),
                `Add them to AndroidChannelIds/AndroidChannels in ${P.mobileConstants}. Android posts a display `
                + 'notification naming an unknown channel on the SDK\'s "Miscellaneous" channel at DEFAULT '
                + 'importance — no heads-up banner, and a name the user cannot recognise.');
        }

        // Data-only pushes are rendered by Notifee, which picks the channel from
        // the clickActionId suffix. A key in no bucket lands on `default`.
        //
        // Every `*_ACTION_KEYS` set is collected rather than a hardcoded list of
        // them. This named REMINDER and REWARD only, so when
        // CONTENT_DISCOVERY_ACTION_KEYS was added for the habits "Friend
        // Activity" channel its five keys started reporting as unbucketed — and
        // five false positives are how the one true finding beside them
        // (PACT_ENDED, in no bucket at all) went unread. A gate nobody believes
        // is a gate nobody reads.
        const bucketNames = [...constants.matchAll(/const\s+(\w+_ACTION_KEYS)\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/g)];
        const bucketed = new Set(bucketNames
            .flatMap((m) => [...m[2].matchAll(/'([A-Z_0-9]+)'/g)].map((k) => k[1])));
        // Only data-only pushes go through Notifee, and only those pick their
        // channel from the clickActionId suffix. A display push names its
        // channel in the FCM payload and never reaches this code.
        // ...and only for the types the brand this binary belongs to can receive.
        // Therr's build never gets a PACT_* push, so Therr's key list not naming
        // one is correct, not a gap.
        const forBrand = mobileBrandLabel || 'Therr';
        const dataOnlyKeys = [...caseFacts.entries()]
            .filter(([type, f]) => f.dataOnly && brandCanReceive(forBrand, type))
            .flatMap(([, f]) => f.clickKeys);
        const unbucketed = [...new Set(dataOnlyKeys)].filter((k) => !bucketed.has(k)).sort();
        if (unbucketed.length) {
            // Naming the buckets actually found, rather than a fixed pair, keeps
            // the remedy correct as channels are added — and makes an empty
            // `bucketed` (the regex having stopped matching) visible here instead
            // of arriving disguised as every key being unbucketed.
            const bucketList = bucketNames.map((m) => m[1]).join(', ') || '(none found — check the regex above)';
            warn('clickaction-channel-default', `${unbucketed.length} data-only intent key(s) fall through to the "default" channel on the "${forBrand}" build`,
                unbucketed.map((k) => `${k} (${keyToType.get(k)})`).join(', '),
                `Notifee renders these on the "default" channel at DEFAULT importance — no heads-up banner. If the type `
                + `is meant to interrupt, add its key to one of the channel buckets in ${P.mobileConstants} `
                + `(${bucketList}). `
                + 'Note Android locks a channel\'s importance at first creation, so this only takes effect on installs '
                + 'that had not created the channel yet.');
        }

        // A display case naming a channel the device does not declare is the
        // reverse failure: the OS posts it on the FCM SDK's auto-created
        // "Miscellaneous" channel, silently.
        const displayChannels = [...new Set([...caseFacts.values()].filter((f) => f.display).flatMap((f) => f.channels))];
        const undeclared = displayChannels.filter((c) => !mobileChannels.has(c));
        if (undeclared.length) {
            blocker('display-channel-undeclared', `${undeclared.length} channel(s) named by display notifications are not declared on the client`,
                undeclared.join(', '),
                `Add them to AndroidChannelIds/AndroidChannels in ${P.mobileConstants} and make sure they are created at `
                + 'app start (createAndroidNotificationChannels), not lazily on first render.');
        }
    }
}

// ---------------------------------------------------------------------------
// A7 — Producers carry their brand
//
// The gateway forwards `x-brand-variation` as '' when absent, and
// getBrandContext then defaults to THERR. An empty brand makes
// resolveDeviceTokenForBrand fall back to the shared legacy token column, so
// the push lands in whichever branded app the user opened last.
// ---------------------------------------------------------------------------
{
    let out = '';
    try {
        out = execFileSync('grep', [
            '-rn', '--include=*.ts', "notifications/send", 'therr-services', 'therr-api-gateway',
        ], { cwd: REPO, encoding: 'utf8' });
    } catch (e) { out = ''; }
    const sites = out.split('\n').filter(Boolean).filter((l) => !l.includes('/node_modules/') && !l.includes('/lib/'));
    if (sites.length) {
        info('push-send-callsites', `${sites.length} call site(s) hit /notifications/send`,
            sites.map((s) => `  ${s.trim()}`).join('\n'),
            'Each must forward a non-empty x-brand-variation. Verify by hand — an empty header is not a type error.');
    }

    // dedupeKey hygiene: a key containing a clock or a random value turns dedup off.
    let dd = '';
    try {
        dd = execFileSync('grep', ['-rn', '--include=*.ts', '-A', '6', 'dedupeKey:', 'therr-services'], { cwd: REPO, encoding: 'utf8' });
    } catch (e) { dd = ''; }
    const badDedupe = dd.split('\n').filter((l) => /dedupeKey/.test(l) && /(Date\.now|Math\.random|new Date\(\)\.getTime|uuid)/.test(l));
    if (badDedupe.length) {
        blocker('dedupe-key-varies', `${badDedupe.length} dedupeKey(s) contain a clock or random value`,
            badDedupe.map((s) => `  ${s.trim()}`).join('\n'),
            'That makes every enqueue unique and silently disables the UNIQUE (brandVariation, userId, dedupeKey) '
            + 'dedup. Use a period stamp (a date) or a stable event id instead.');
    }
}

// ---------------------------------------------------------------------------
// A8 — Brand-only type sets are exhaustive as brands are added
//
// `isTypeAllowedForBrand` today hardcodes a single niche brand. A second niche
// app needs its own <BRAND>_ONLY_TYPES, or its types are routable under Therr —
// which addresses them to the user's Therr install.
// ---------------------------------------------------------------------------
{
    // A brand only needs an ONLY_TYPES rule once it owns types no other brand
    // ships — which shows up as intent-action keys unique to its enum. Teem
    // declares nothing of its own, so it needs no rule.
    const keysOf = (label) => new Set((brandIntentEnums.get(label) || new Map()).keys());
    const ownsExclusiveTypes = (label) => {
        const mine = keysOf(label);
        const others = new Set([...brandIntentEnums.keys()].filter((l) => l !== label).flatMap((l) => [...keysOf(l)]));
        return [...mine].some((k) => !others.has(k));
    };
    const nicheBrands = [...brandVariations.entries()]
        .filter(([, v]) => v !== 'therr' && !BRANDS_WITHOUT_OWN_APP.has(v))
        .map(([k]) => k)
        .filter((b) => {
            const label = [...labelToBrandMember.entries()].find(([, member]) => member === b)?.[0];
            return label && ownsExclusiveTypes(label);
        });
    const guardScope = (firebaseSrc.match(/isTypeAllowedForBrand[\s\S]*?\n\};/) || [''])[0];
    const guarded = nicheBrands.filter((b) => new RegExp(`${b}_ONLY_TYPES`, 'i').test(firebaseSrc)
        || new RegExp(`BrandVariations\\.${b}`).test(guardScope));
    const unguarded = nicheBrands.filter((b) => !guarded.includes(b));
    if (unguarded.length > 0) {
        warn('brand-only-types-unguarded', `${unguarded.length} brand(s) with their own app have no <BRAND>_ONLY_TYPES rule`,
            unguarded.join(', '),
            'A type that only exists in one niche app must be blocked under every other brand — the brand selects '
            + 'the device token, so a leaked type is delivered to the wrong app entirely, not merely deep-linked wrong. '
            + `Generalise \`isTypeAllowedForBrand\` in ${P.firebaseAdmin} to a Record<BrandVariations, Set<Types>>.`);
    }
}

// ---------------------------------------------------------------------------
function report() {
    if (asJson) {
        console.log(JSON.stringify({ findings }, null, 2));
        return;
    }
    const order = { BLOCKER: 0, WARN: 1, INFO: 2 };
    const sorted = [...findings].sort((a, b) => order[a.level] - order[b.level]);
    const counts = findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] || 0) + 1 }), {});
    console.log('');
    console.log('Push notification wiring check');
    console.log(`  branch: ${(() => { try { return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) { return '?'; } })()}`
        + (brandBranch ? `   mobile files from: ${brandBranch}` : ''));
    console.log('');
    if (!sorted.length) {
        console.log('  ✓ No wiring gaps found.');
    }
    for (const f of sorted) {
        const mark = f.level === 'BLOCKER' ? '✗' : (f.level === 'WARN' ? '!' : 'ℹ');
        console.log(`  ${mark} [${f.level}] ${f.title}   (${f.id})`);
        if (f.detail) console.log(`      ${String(f.detail).split('\n').join('\n      ')}`);
        if (f.fix) console.log(`      → ${f.fix}`);
        console.log('');
    }
    console.log(`  ${counts.BLOCKER || 0} blocker(s), ${counts.WARN || 0} warning(s), ${counts.INFO || 0} note(s)`);
    console.log('');
}

report();
process.exit(findings.some((f) => f.level === 'BLOCKER') ? 1 : 0);
