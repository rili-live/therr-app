# Secrets and Local Bootstrap

This document catalogs every gitignored file, environment variable, and
external credential a developer needs to build, run, and ship this monorepo.
Use it for onboarding, machine setup, secret rotation, and disaster recovery.

The motivating risk: most of these files are ignored by git for good reason
(secrets must not enter the repo), but the absence of a documented recovery
procedure means a single laptop loss or a corrupted file can block builds
indefinitely while the developer reconstructs each piece from scratch.

---

## Canonical secret store

This repo's authoritative store of bootstrap secrets is whatever the
developer/team uses for password management (e.g., 1Password, Bitwarden,
Vault). Update this section to name yours and its access process.

For each secret listed below, the canonical store should hold:
- The current value (or the file content, encrypted)
- The fingerprint / hash of any binary file (to detect drift)
- The date of last rotation
- A pointer to the upstream regeneration procedure (which Firebase project,
  which AWS IAM user, etc.)

A new developer joining the team should be able to clone the repo and, with
read access to the secret store, populate every gitignored file in this
document and have a working build.

---

## Mobile (TherrMobile) secrets

### `TherrMobile/android/app/google-services.json`

**What it is:** Firebase configuration for the Android client. Defines the
Firebase project and a `client[]` entry for the build's `applicationId`. Read
by Gradle's `com.google.gms.google-services` plugin at build time.

**Source of truth:** Per-brand vault at `_bin/firebase/<brand>/google-services.json`
(also gitignored). The active build file at
`TherrMobile/android/app/google-services.json` is **populated by
`_bin/switch-brand.sh <brand>`** — it is treated as a build artifact, not a
hand-edited file. Editing it directly will be overwritten by the next
`switch-brand.sh` run. See `_bin/firebase/README.md` for the vault convention.

**Current contents (as of 2026-05-10):**
- Project: `therr-app` (single Firebase project shared by all brand variants)
- Active file contains exactly one `client[]` entry — the brand currently
  selected by the most recent `switch-brand.sh` invocation:
  - `app.therrmobile` (Therr — default brand)
  - `com.therr.habits` (Friends with Habits)
  - Future TEEM `package_name` will be added when registered in Firebase.

**Why gitignored:** Contains an OAuth client ID and API key. Even though both
are scoped (the OAuth client is restricted to the registered SHA-1
fingerprints, and the API key has Android-app restrictions), keeping them out
of the repo reduces the blast radius of an accidental public repo flip.

**Regenerate from upstream if lost:**
1. Sign in to https://console.firebase.google.com/project/therr-app/settings/general
2. Under "Your apps", for **each** registered Android app, click "Download
   google-services.json".
3. Save each download to `_bin/firebase/<brand>/google-services.json` —
   `therr/` for `app.therrmobile`, `habits/` for `com.therr.habits`. No
   manual merging required; each file holds exactly one `client[]` entry.
4. Run `./_bin/switch-brand.sh <brand>` to copy the matching file into
   `TherrMobile/android/app/google-services.json` and validate it. The
   script will fail loudly if the JSON's `package_name` doesn't match the
   brand's expected `applicationId`.
5. Verify by building (`cd TherrMobile && npm run android:<brand>`) — should
   succeed without the "No matching client found" Gradle error.

**Sanity-check templates:** Each brand has a committed sanitized template
next to its vault entry, with secrets scrubbed:
- `_bin/firebase/therr/google-services.example.json` — one `client[]` entry,
  `package_name == app.therrmobile`.
- `_bin/firebase/habits/google-services.example.json` — one `client[]` entry,
  `package_name == com.therr.habits`.

Diff your real `_bin/firebase/<brand>/google-services.json` against the
matching template to confirm shape; if your file has extra or different
`client[]` entries, re-export the matching Android app from Firebase
Console. `TherrMobile/android/app/google-services.example.json` is kept as
a pointer that lists the per-brand template paths above.

**See also:** `docs/MULTI_BRAND_ARCHITECTURE.md` for the brand-flag-driven
build behavior; `_bin/firebase/README.md` for the vault layout and
populating procedure; `TherrMobile/CLAUDE.md` for module-resolution gotchas.

---

### `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`

**What it is:** iOS equivalent of `google-services.json`. Read by the
Firebase iOS SDK at runtime (not build time).

**Current state:** Should exist on disk for iOS builds; gitignored. Like the
Android counterpart, this is per-Firebase-project. iOS does NOT support the
merged-file pattern — each `BUNDLE_ID` requires its own plist.

**Source of truth:** Per-brand vault at
`_bin/firebase/<brand>/GoogleService-Info.plist`. `_bin/switch-brand.sh
<brand>` copies the matching file into
`TherrMobile/ios/TherrMobile/GoogleService-Info.plist` on every run.
Currently only `_bin/firebase/therr/GoogleService-Info.plist` is populated
because Therr is the only brand shipping iOS today; switching to a niche
brand without a vault plist leaves the Therr plist in place and prints a
non-fatal warning.

**Regenerate from upstream if lost:**
1. Firebase Console → therr-app project → iOS app entry for the brand.
2. Download `GoogleService-Info.plist`.
3. Save to `_bin/firebase/<brand>/GoogleService-Info.plist`.
4. Run `./_bin/switch-brand.sh <brand>` to copy it into
   `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`.

---

### `TherrMobile/.env`

**What it is:** Mobile-app build-time secrets, loaded via
`react-native-dotenv` and surfaced in `metro.config.js`.

**Required keys:**
```
GOOGLE_APIS_ANDROID_KEY=<Google Maps SDK key, Android-restricted>
GOOGLE_APIS_IOS_KEY=<Google Maps SDK key, iOS-restricted>
```

**Why gitignored:** Both keys are billable. Public exposure could result in
surprise bills if abused.

**Regenerate from upstream if lost:**
1. https://console.cloud.google.com/apis/credentials (project `therr-app`)
2. Identify the Android-restricted and iOS-restricted Maps SDK keys
3. If the keys have rotated, you may need to view (or create new) restricted
   keys; restrictions are bound to package_name + SHA-1 (Android) or
   bundle_id (iOS), so per-brand keys may be appropriate

**Build behavior without it:** Maps will not render; Google Sign-In on
mobile will fail.

---

### `TherrMobile/android/app/therr-upload.keystore`

**What it is:** Android upload signing key for the Therr brand variant. The
Play Console binds the published Therr listing's signing identity to this
key's fingerprint.

**Why gitignored:** Anyone with this file + the passwords can publish
malicious updates to the Therr Play listing. Treat as one of the highest-
sensitivity secrets in the entire stack.

**Regenerate from upstream if lost:**
**You cannot regenerate an upload keystore.** If lost, you must follow
Google's upload-key reset procedure:
https://support.google.com/googleplay/android-developer/answer/7384423
This requires Play Console support intervention and can take 1–2 weeks.

**Backup procedure (do this now if you haven't):**
1. Copy the file to your password manager as a binary attachment
2. Store the keystore password and key password as separate fields
3. Note the SHA-1 and SHA-256 fingerprints (run `keytool -list -v -keystore therr-upload.keystore`) for use in Firebase Console and Google Cloud OAuth client config
4. Verify quarterly that the backup is still readable

---

### CircleCI env var: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

**What it is:** The full JSON key for a Google Play service account, used by
`TherrMobile/_scripts/populate-play-release-notes.mjs` (run in the
`eas_build_therr_android` CircleCI job) to push the user-facing "What's new"
release notes to the Play internal track after `eas build --auto-submit`.
EAS Submit uploads the AAB but does not manage release notes, so this closes
that gap.

**Required scope:** The service account must have the **Release manager**
permission on the Therr Play listing (Play Console → Users & permissions).
This is the *same* service account already configured on EAS for
`--auto-submit`; you are reusing its key JSON, just also storing it in
CircleCI.

**Why gitignored / secret:** The key can publish releases and edit the store
listing. Treat as high-sensitivity. It is stored as a CircleCI project-level
environment variable (paste the entire JSON as the value), **not** committed.

**Setup:**
1. CircleCI → Project Settings → Environment Variables → Add Variable.
2. Name: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; Value: the full service-account
   JSON (single line is fine).
3. If unset, the CI step logs a skip and the pipeline still succeeds — release
   notes simply won't be updated until the var is added.

**Regenerate from upstream if lost:**
Google Cloud Console → project `therr-app` → IAM & Admin → Service Accounts →
the Play publisher account → Keys → Add key → JSON. Then re-grant it access in
Play Console if needed.

---

### `TherrMobile/android/app/habits-upload.keystore` (planned, not yet created)

**What it will be:** Android upload signing key for the Friends with Habits
brand variant. Required for Phase 5 Play submission.

**Generation procedure:** See `docs/niche-sub-apps/HABITS_PLAY_LISTING.md`
section "Keystore generation."

**Backup procedure:** Same as `therr-upload.keystore` above. Do this
immediately after generation.

---

### `~/.gradle/gradle.properties` (per-developer machine)

**What it is:** Gradle properties file holding signing credentials. Located
in the developer's home directory, not in the repo.

**Required keys for release builds:**
```
# Therr
MYAPP_UPLOAD_STORE_FILE=therr-upload.keystore
MYAPP_UPLOAD_KEY_ALIAS=therr-upload
MYAPP_UPLOAD_STORE_PASSWORD=<from password manager>
MYAPP_UPLOAD_KEY_PASSWORD=<from password manager>
```

**Per-brand handling:** Today only Therr's keystore properties are wired
into `TherrMobile/android/app/build.gradle:104-111`. When `habits-upload.keystore`
exists, you have two options:
- Override the same `MYAPP_UPLOAD_*` properties before each release build
  (one-keystore-at-a-time)
- Extend `build.gradle` to read `MYAPP_UPLOAD_STORE_FILE_HABITS` etc. and
  pick based on `applicationId` at signingConfig resolution time

The second is cleaner long-term; the first ships HABITS faster.

---

### `TherrMobile/android/app/debug.keystore`

**What it is:** Pre-shared debug signing key. Comes with React Native
template. Same SHA-1 fingerprint across machines so Firebase debug builds
work consistently.

**Why gitignored:** Convention. The debug key is publicly known (it's
identical for every React Native project). Loss is harmless — `keytool` can
regenerate it. The fingerprint must be registered in Firebase Console under
the relevant Android app entry for Google Sign-In to work in debug builds.

**Regenerate:** `keytool -genkey -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`

---

## Backend service secrets

Each backend service in `therr-services/` and `therr-api-gateway/` reads
secrets from environment variables. Local development uses `.env` files
(gitignored); production uses Kubernetes Secrets in the `default` namespace.

### Local `.env` files (per service)

The following service directories may contain a local `.env` file:
- `therr-api-gateway/.env`
- `therr-services/users-service/.env`
- `therr-services/maps-service/.env`
- `therr-services/messages-service/.env`
- `therr-services/reactions-service/.env`
- `therr-services/push-notifications-service/.env`
- `therr-services/websocket-service/.env`

**Common keys** (varies per service; consult each service's `CLAUDE.md` or
`config.ts` for the authoritative list):
- Database connection strings (`POSTGRES_*`)
- Redis URL (`REDIS_URL`)
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- JWT signing secrets (`JWT_SECRET`)
- OAuth client secrets (`GOOGLE_OAUTH2_*`, `APPLE_*`, `FACEBOOK_*`)
- Push notification credentials (`PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64*`)
- Twilio (`TWILIO_*`) — SMS verification
- SendGrid / mail (`SENDGRID_*`)
- Stripe (`STRIPE_*`) — when monetization ships
- Honeycomb (`HONEYCOMB_API_KEY`) — observability

**Regenerate from upstream:** Each integration provider has its own console
(AWS IAM, Twilio, SendGrid, Stripe, Firebase, Google Cloud). Maintain a
mapping in your password manager from env-var name → upstream console URL +
which IAM identity owns the key.

### Kubernetes Secrets (production)

Production secrets are stored as Kubernetes Secret objects in the `default`
namespace of the GKE cluster. They are referenced from Deployment YAMLs
under `k8s/prod/` via `valueFrom.secretKeyRef`.

**To list current Secret objects:**
```bash
kubectl get secrets -n default
```

**To inspect a specific Secret without printing values:**
```bash
kubectl describe secret <secret-name> -n default
```

**Backup procedure:** Production Secrets should be mirrored in the canonical
secret store. Do not rely on the cluster as the only copy — a botched
`kubectl delete secret` is unrecoverable without a backup.

---

## Web client secrets

### `therr-client-web/.env` (build-time)

Build-time variables baked into the SSR bundle. Read at server startup.

**Examples:** `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`,
`PINTEREST_VERIFICATION`, `INDEXNOW_API_KEY`. These are not secrets per se
(they end up in HTML meta tags or as path components), but they should be
documented somewhere reproducible.

Production values are sourced from the `client-deployment.yaml` env block
in `k8s/prod/` rather than a `.env` file.

---

## Cloudflare and DNS

### Cloudflare API token (for ingress / DNS scripts)

**What it is:** Cloudflare API token used by any deploy or DNS-management
script (e.g., for setting up new subdomains like `habits.therr.com`).

**Scope:** Should be a token (not the global API key) restricted to specific
zones (`therr.com`, `therr.app`) and specific permissions (DNS:Edit).

**Where it lives:** Developer's password manager. CI / k8s do not currently
need this token because cert-manager handles TLS via DNS-01 or HTTP-01
challenges automatically once the host is added to ingress + DNS records
exist.

**Regenerate:** Cloudflare dashboard → My Profile → API Tokens → Create
Token → use the "Edit zone DNS" template restricted to the relevant zones.

---

## Disaster recovery scenario

**"My laptop died and I'm provisioning a new dev machine."** The order to
restore in:

1. Install Node 24.12.0, npm 11+, Android Studio, Xcode, kubectl, gcloud
2. Clone the monorepo
3. From password manager, restore in this order:
   - `TherrMobile/.env`
   - `TherrMobile/android/app/google-services.json`
   - `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`
   - `TherrMobile/android/app/therr-upload.keystore` (if releasing)
   - `TherrMobile/android/app/habits-upload.keystore` (if releasing HABITS)
   - `TherrMobile/android/app/debug.keystore` (or generate fresh)
   - `~/.gradle/gradle.properties` (signing properties)
   - Any backend service `.env` files needed for local dev
4. `npm install --legacy-peer-deps` at root and in `TherrMobile/`
5. Authenticate to GCP: `gcloud auth login` and configure kubectl context
6. Verify mobile build: `cd TherrMobile && npm run android`
7. Verify backend dev stack: `docker compose -f docker-compose.infra.yml up`

If any step fails because a secret is missing or stale, **document the gap
here** so the next person doesn't hit it.

---

## Audit checklist

Run this checklist quarterly:

- [ ] All keystores are backed up in the canonical secret store
- [ ] All keystore passwords are in the canonical secret store, separately from the keystores
- [ ] All Firebase service-account credentials in the password manager match the active values in the Kubernetes Secrets
- [ ] All AWS IAM keys in use have been rotated within the last 90 days
- [ ] All OAuth client secrets in use are still listed as authorized in the upstream provider
- [ ] The `google-services.json` in the repo has client blocks for every active brand variant
- [ ] No secrets have been accidentally committed to the repo (`git log --all -p | grep -iE 'BEGIN PRIVATE KEY|aws_secret|password='` returns no surprises)

---

## When to update this document

Update when:
- A new secret is introduced (add to the relevant section)
- An existing secret is rotated to a new provider/format (update the regenerate procedure)
- A new brand variant is added (add to per-brand entries)
- Disaster recovery is performed and a gap is discovered (add to the recovery scenario)

Do NOT add the actual secret values to this document. Only:
- The name of each secret
- Where it lives (file path or env var)
- Why it exists
- How to regenerate it from upstream
- Where the canonical backup is stored
