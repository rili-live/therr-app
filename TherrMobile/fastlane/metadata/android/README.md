# Google Play release notes ("What's new")

These files hold the user-facing **release notes** shown on the Google Play
listing for each Android release.

## Setting them is a manual paste

EAS Submit uploads the AAB but does **not** manage release notes, and nothing
sets them automatically. `TherrMobile/_scripts/print-play-release-notes.mjs`
resolves the text for the versionCode being built and prints it as a
copy/paste block; it runs **before** the `eas build --auto-submit` step in the
`eas_build_therr_android` CircleCI job (see `.circleci/config.yml`), so the
notes are in the job log even if the build step later times out.

Paste them in at:
**Play Console → Release → Releases overview → the release → Edit → "What's new
in this release"**, for each language.

> This used to push the notes to Play over the Developer API, polling the track
> until EAS Submit's upload appeared. EAS Submit is asynchronous and the upload
> routinely landed after the poll window closed, so the notes were silently
> never written and the only symptom was a failed step at the end of an
> otherwise-successful build. The timing dependency was removed rather than
> tuned.

Run it locally against the current `versionCode` with:

```bash
npm --prefix TherrMobile run play:release-notes
```

## Layout (Fastlane `supply` convention)

```
fastlane/metadata/android/<play-locale>/changelogs/<versionCode>.txt   # notes for one specific build
fastlane/metadata/android/<play-locale>/changelogs/default.txt         # fallback used when no <versionCode>.txt exists
```

- `<play-locale>` uses Google Play BCP-47 codes. We ship: `en-US`, `es-419`
  (Latin-American Spanish), `fr-CA` — matching the app's three locales.
- `<versionCode>` matches `versionCode` in `TherrMobile/android/app/build.gradle`.

The script looks for `<versionCode>.txt` first and falls back to `default.txt`.

## Writing good notes (Google Play guidelines)

- **≤ 500 characters** per language (hard limit enforced by Play).
- **High-level and user-facing** — describe what changed for the user, not
  internal refactors, ticket numbers, or library bumps.
- **Concise.** A short intro line plus a few bullets is ideal.
- No promotional spam, ALL-CAPS, emoji walls, prices, or references to other
  apps/platforms.

## Adding notes for a specific release

Copy `default.txt` to `<versionCode>.txt` in each locale and tailor the text,
or just keep `default.txt` current — it applies to every build that lacks a
version-specific file.
