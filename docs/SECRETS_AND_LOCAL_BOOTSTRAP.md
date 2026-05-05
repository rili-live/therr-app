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
Firebase project and a `client[]` entry per registered `applicationId`. Read
by Gradle's `com.google.gms.google-services` plugin at build time, which
selects the matching client block from the build's `applicationId`.

**Current contents (as of 2026-04-23):**
- Project: `therr-app` (single Firebase project shared by all brand variants)
- Registered `package_name`s:
  - `app.therrmobile` (Therr — the default brand)
  - `com.therr.habits` (Friends with Habits)
  - Future TEEM `package_name` should be added here when introduced

**Why gitignored:** Contains an OAuth client ID and API key. Even though both
are scoped (the OAuth client is restricted to the registered SHA-1
fingerprints, and the API key has Android-app restrictions), keeping them out
of the repo reduces the blast radius of an accidental public repo flip.

**Regenerate from upstream if lost:**
1. Sign in to https://console.firebase.google.com/project/therr-app/settings/general
2. Under "Your apps", click each Android app entry
3. Click "Download google-services.json" — repeat for each registered app
4. The downloaded files each contain the full project config and a single
   `client[]` entry for that app
5. Manually merge: take any one as the base, then copy the `client[]` array
   entries from the others into the base's `client[]` array
6. Save the merged file at `TherrMobile/android/app/google-services.json`
7. Verify by building both Therr (`switch-brand.sh therr`) and Habits
   (`switch-brand.sh habits`) — both should succeed without the
   "No matching client found" Gradle error

**Sanity-check template:** `TherrMobile/android/app/google-services.example.json`
shows the expected shape (with secrets scrubbed). Compare your real file's
`client[].client_info.android_client_info.package_name` list to the example;
if the real file is missing entries listed in the example, you have a stale
copy and need to re-export from Firebase Console.

**See also:** `docs/MULTI_BRAND_ARCHITECTURE.md` for the brand-flag-driven
build behavior; `TherrMobile/CLAUDE.md` for module-resolution gotchas.

---

### `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`

**What it is:** iOS equivalent of `google-services.json`. Read by the
Firebase iOS SDK at runtime (not build time).

**Current state:** Should exist on disk for iOS builds; gitignored. Like the
Android counterpart, this is per-Firebase-project. iOS does NOT support the
merged-file pattern — each `BUNDLE_ID` requires its own plist.

**Per-brand handling:** Currently the iOS build serves only Therr. When
HABITS iOS ships, the build pipeline will need either Xcode build phase
schemes that swap the plist or an `_bin/switch-brand.sh` extension that
copies from `_bin/firebase/<brand>/GoogleService-Info.plist`.

**Regenerate from upstream if lost:**
1. Firebase Console → therr-app project → iOS app entry
2. Download `GoogleService-Info.plist`
3. Place at `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`

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

---

## EAS (Expo Application Services) — HABITS Android CI/CD

The `niche/HABITS-main` branch triggers an EAS cloud build + Google Play submit
via CircleCI (`habits_mobile_release` workflow in `.circleci/config.yml`).
EAS runs the actual Android build on Expo's infrastructure, so the CI runner
only needs `eas-cli` installed — no local Android SDK required.

### One-time setup (do this before the first CI build)

1. **Create an Expo account** at https://expo.dev if you don't have one.

2. **Link the project to EAS** from the `TherrMobile` directory:
   ```bash
   cd TherrMobile
   npm install -g eas-cli
   eas login
   eas init --id <new-project-id>   # or let eas init auto-create the project
   ```
   After `eas init`, commit the updated `app.json` — it will have the real
   `projectId` replacing `REPLACE_WITH_EAS_PROJECT_ID`, and `owner` set to
   your Expo username.

3. **Upload the HABITS keystore to EAS credentials**:
   ```bash
   eas credentials --platform android --profile habits-internal
   ```
   Choose "Upload an existing keystore" and provide `habits-upload.keystore`
   (see keystore section below). EAS stores it encrypted; the CI job will
   download it at build time via `credentialsSource: "remote"` in `eas.json`.

4. **Store the Google Maps API key as an EAS secret**:
   ```bash
   eas secret:create --scope project --name GOOGLE_APIS_ANDROID_KEY --value <key>
   ```
   Use the Android-restricted Maps SDK key for `com.therr.habits`.

5. **Store the Google Play service account key as an EAS secret**:
   ```bash
   eas secret:create --scope project --name EXPO_GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON \
     --type file --value ./path-to-service-account.json
   ```
   This is the service account JSON from the Google Play Console that has
   "Release manager" or "Release" permissions on the `com.therr.habits` listing.
   EAS Submit reads it automatically when `EXPO_GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON`
   is set.

6. **Add `EXPO_TOKEN` to CircleCI project environment variables**:
   - Generate a token at https://expo.dev/settings/access-tokens
   - In CircleCI: Project Settings → Environment Variables → `EXPO_TOKEN`

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
