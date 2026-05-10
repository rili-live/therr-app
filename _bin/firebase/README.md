# Per-brand Firebase config vault

This directory holds the **source of truth** for the Firebase mobile-client
config files used by each brand variation. The actual files (the ones with
secret payloads) are gitignored; this README is committed so the convention
is discoverable.

## Directory layout

```
_bin/firebase/
├── README.md                              <-- this file (committed)
├── therr/
│   ├── google-services.example.json       <-- committed sanitized template
│   ├── google-services.json               <-- Android, package_name=app.therrmobile (gitignored)
│   └── GoogleService-Info.plist           <-- iOS, BUNDLE_ID=app.therrmobile (gitignored)
├── habits/
│   ├── google-services.example.json       <-- committed sanitized template
│   ├── google-services.json               <-- Android, package_name=com.therr.habits (gitignored)
│   └── GoogleService-Info.plist           <-- iOS, when Habits ships on iOS (gitignored)
└── teem/
    └── (future, when TEEM is registered in Firebase)
```

Each `google-services.json` is the **unmodified single-app export** from
Firebase Console — no manual merging required. The sibling
`google-services.example.json` is a committed, sanitized template you can
diff your real file against to confirm shape (one `client[]` entry,
correct `package_name`).

## How it gets used

`_bin/switch-brand.sh <brand>` copies the matching files into the active
build locations every time it runs:

| Source (this dir)                                   | Destination (active build)                              |
|-----------------------------------------------------|---------------------------------------------------------|
| `_bin/firebase/<brand>/google-services.json`        | `TherrMobile/android/app/google-services.json`          |
| `_bin/firebase/<brand>/GoogleService-Info.plist`    | `TherrMobile/ios/TherrMobile/GoogleService-Info.plist`  |

After copying, the script validates that the Android JSON's `package_name`
matches the expected `applicationId` for the brand and prints the registered
SHA-1 fingerprint so you can eyeball it against your local debug keystore.

**Do not edit the destination files directly.** The next `switch-brand.sh`
run will overwrite them. Edit the vault copy here, then re-run the script.

## Populating the vault

1. Firebase Console → therr-app project → Project Settings → Your apps.
2. For each Android app entry (one per `package_name`):
   - Click "Download google-services.json".
   - Save to `_bin/firebase/<brand>/google-services.json` (overwriting any
     previous copy).
3. For each iOS app entry (one per `BUNDLE_ID`):
   - Click "Download GoogleService-Info.plist".
   - Save to `_bin/firebase/<brand>/GoogleService-Info.plist`.

Then run `./_bin/switch-brand.sh <brand>` to verify and apply.

See `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md` for the broader secret-recovery
procedure (includes other gitignored credentials beyond Firebase).

## SHA-1 fingerprints (must be registered upstream, not stored here)

`google-services.json` embeds the SHA-1 fingerprints registered for that
Android app in Firebase Console. If your local debug keystore changes, or
you build from a new machine, the SHA-1 won't match and Google Sign-In will
silently cancel. Print your local SHA-1 with:

```bash
keytool -list -v \
    -keystore TherrMobile/android/app/debug.keystore \
    -alias androiddebugkey \
    -storepass android -keypass android | grep SHA1
```

If the printed value doesn't appear in the matching brand's
`_bin/firebase/<brand>/google-services.json` (under
`oauth_client[].android_info.certificate_hash`, lowercase, no colons),
add it in Firebase Console under that Android app's "SHA certificate
fingerprints" and re-download the JSON into the vault.

## Shared Firebase project (today)

All brand variants share **one** Firebase project, `therr-app`. They each
have their own Android/iOS app entry within that project, which is what
makes the per-brand-file split clean: each export contains only that
brand's `client[]` (Android) or whole-file (iOS) config, but the
`project_info.project_number` is the same across both — and that
`project_number` is the prefix on the `googleOAuth2WebClientId*` values in
`TherrMobile/env-config.js`. So the webClientId in env-config.js is the
same for both brands and never needs to change when switching.

If/when a brand splits into its own Firebase project, see
`docs/MULTI_BRAND_ARCHITECTURE.md` "Migration path: when to split into
per-brand Firebase projects" for the full procedure.
