---
name: niche-android-release
description: Ship a niche Android app (Friends with Habits) to the Google Play internal track end to end. Checks that the versionCode/versionName on niche/<TAG>-general are new, merges it into niche/<TAG>-main and pushes (which starts the CircleCI EAS build), watches CI and EAS to see whether EAS is actually building and auto-submitting it, and — only when nothing else will upload that versionCode (EAS quota spent, CI skipped) — builds the signed AAB locally and submits it with eas submit. Use when asked to release, ship, publish or build-and-upload the habits app / an AAB, or when a niche/HABITS-main merge's EAS job failed.
user-invocable: true
allowed-tools: Bash(node _bin/niche-android-release.js*), Bash(node*), Bash(git*), Bash(npm*), Bash(gh*), Bash(eas*), Read, Edit, Skill, AskUserQuestion
argument-hint: [habits] [--skip-preflight] [--allow-same-version-name] [--dry-run]
---

# Niche Android Release

The release of a niche Android app is a merge of `niche/<TAG>-general` into `niche/<TAG>-main`.
CircleCI's `eas_build_<brand>_android` job then runs `eas build --auto-submit`, and the AAB
lands on the Play **internal** track as a **draft**. That job can go red without compiling
anything. For Friends with Habits builds 46–50 it failed every time because the EAS
free-plan Android build quota was spent, and each of those builds was made and uploaded by
hand.

Doing it by hand has two failure modes, and Play reports both only *after* the upload:

1. **A versionCode that isn't new.** Play rejects any versionCode it has already seen.
2. **Racing EAS.** If an EAS build of the same versionCode is only queued, a local upload
   and the EAS auto-submit both target one versionCode, and whichever lands second is
   rejected.

This skill does the merge, then decides from CI **and** EAS who uploads the build, and builds
locally only when the answer is nobody.

All mechanics live in `_bin/niche-android-release.js`, and its decisions live in
`_bin/lib/niche-android-release.js`, tested by `npm run test:bin-scripts`. Run it from the
repo root. Every subcommand accepts `--tag HABITS` (inferred from a `niche/<TAG>-*` branch)
and `--json`.

| Subcommand | Does | Exit |
|---|---|---|
| `check` | versionCode/versionName novelty against main's history, EAS builds and ledger tags | 1 on blockers |
| `merge [--dry-run]` | merge in memory (`merge-tree` + `commit-tree`, no checkout) and push to `niche/<TAG>-main` | 1 if blocked |
| `watch <sha>` | poll the CircleCI status and EAS until it's decided who uploads | 3 = local needed |
| `build <sha>` | rebuild the shared libs, `:app:bundleRelease`, verify package/version/upload key | 1 on failure |
| `submit <sha>` | `eas submit` to the internal track as a draft, then push the ledger tag | 1 on failure |

**Ledger tags.** Each local upload pushes an annotated tag `<brand>-android-vc<versionCode>`
(for example `habits-android-vc51`) on the merge commit. EAS keeps its own record of the builds
it made, and these tags record the ones it didn't. `check`, `watch`, `build` and `submit` all
treat a tag as "already uploaded". Builds uploaded by hand before this skill existed (≤ 50)
have no tag. `check` still blocks on them through main's history, but `watch` can't see them.

---

## Step 1: Check

```bash
node _bin/niche-android-release.js check
```

Act on `status`:

- **`STALE`**: stop and report the blockers. **Never bump the version yourself.** Tell the
  user the minimum versionCode and ask for the versionName. It must be a deliberate
  commit on `niche/<TAG>-general` with `<versionCode>.txt` changelogs, like
  `chore(habits): bump to 1.12.0 (50) with Play release notes`.
- **`ALREADY_RELEASED`**: an EAS build or a ledger tag already covers this versionCode, so
  report that and stop.
- **`MERGED_PENDING`**: already merged, with no upload on record. Skip to Step 4 using
  `mergeSha` from the output.
- **`NEW`**: continue.

Surface every `WARN`. A missing `<versionCode>.txt` changelog means Play users see
`default.txt`.

## Step 2: Preflight

Unless `--skip-preflight` was passed or `/mobile-release-preflight` already returned **GO**
this session for this versionCode, run `/mobile-release-preflight --brand <brand>`. On **NO-GO**,
stop. A blocker there (tsc, Jest, lint, locales, patch drift) ships to every device and can't
be rolled back.

## Step 3: Merge and push

```bash
node _bin/niche-android-release.js merge            # add --dry-run to stop before pushing
```

Invoking this skill is the go-ahead to push. The push is **not forced**: if origin moved
since the fetch it is rejected, and you re-run. It goes through the pre-push test hook, so give
the command a 10-minute timeout, and **never** add `--no-verify` to get past a failing test.
Note the printed merge sha, which is what CI builds.

## Step 4: Watch

Run it in the background, since it can take minutes before CI reports anything:

```bash
node _bin/niche-android-release.js watch <merge-sha>          # --timeout-min 45 by default
```

It exits as soon as the path is decided:

| Decision | Meaning | Next |
|---|---|---|
| `EAS_HANDLING` | an EAS build of this commit/versionCode is queued or running; it auto-submits | Report the EAS build link and stop. **Do not build locally.** Add `--until-finished` if the user wants to wait for it |
| `EAS_DONE` | EAS finished and auto-submitted | Step 7 |
| `LOCAL_DONE` | a ledger tag shows it was already uploaded locally | Step 7 |
| `LOCAL_NEEDED` / `eas-quota` | EAS free-plan quota spent, no build exists | Step 5, no need to ask |
| `LOCAL_NEEDED` / `ci-skipped` | CI went green without building. It judged the merge to have no mobile changes | Step 5, but say that this is unexpected for a release |
| `LOCAL_NEEDED` / `ci-failed`, `eas-auth`, `eas-build-errored` | CI or the EAS build broke for another reason | Show the CI/EAS log excerpt and **ask the user** before Step 5. A code failure on EAS will usually fail locally too, and an auth failure needs fixing in CI rather than bypassing |

An EAS build that exists always beats the CI job's state. The job's CLI can be killed by
its own no-output timeout after the build is registered, and the build and its auto-submit
carry on server-side.

## Step 5: Build locally

```bash
node _bin/niche-android-release.js build <merge-sha>          # run in background, ~4–10 min
```

It refuses when:
- `TherrMobile/` or `therr-public-library/` in the working tree differs from the merge commit.
  The fix is to check out `niche/<TAG>-general` at origin's tip and stash local changes. Never
  build from a dirty tree, because then the AAB isn't the release.
- `brandConfig.ts` / `app.json` aren't this brand's.
- `google-services.json` has no client for the applicationId, `.env` lacks
  `GOOGLE_APIS_ANDROID_KEY`, or `<PREFIX>_UPLOAD_STORE_FILE` isn't in
  `~/.gradle/gradle.properties`.
- An EAS build of this versionCode is live or finished, or its ledger tag exists.

It rebuilds `therr-js-utilities`, `therr-styles` and `therr-react` before Gradle. Metro bundles
their gitignored `lib/` output, which is only as fresh as the last local build. EAS rebuilds
it in `eas-build-pre-install.sh`, and a local build has to as well. After the build it checks the
merged manifest (applicationId, versionCode, versionName) and that `jarsigner` shows the
brand's upload-key OU. On failure it prints the tail of the log file.

## Step 6: Submit

```bash
node _bin/niche-android-release.js submit <merge-sha>
```

It re-checks that nothing else is uploading, runs `eas submit --profile <brand>-internal`
(internal track, draft, not sent for review), then tags and pushes `<brand>-android-vc<N>`.
EAS Submit is separate from the build quota. If Play says the versionCode was already used,
it was uploaded outside the ledger. Stop and tell the user. Don't retry and don't bump
anything.

## Step 7: Follow-ups and report

Print the release notes for the user to paste:

```bash
node TherrMobile/_scripts/print-play-release-notes.mjs
```

Then add to `docs/WORK_IN_PROGRESS.md`, immediately before `<!-- skill-followups:end -->`, after
reading the file and matching on action text so nothing is duplicated:

- `- [ ] (YYYY-MM-DD, /niche-android-release) **Promote <App> <versionName> (<versionCode>) out of the internal-track draft and paste its release notes.** …`
  Include this every time: nothing sets "What's new" automatically, and the draft reaches
  nobody until someone rolls it out.
- Only when the reason was `eas-quota` and no open item already covers it: the quota
  follow-up, with its reset date.

Log the release to today's `context/memory/` daily log, silently.

Report:

```
## <App> <versionName> (<versionCode>) — released via <EAS | local build>

Version:  <versionName> (<versionCode>)   previous: <…> (<…>)
Merge:    <sha> → niche/<TAG>-main (pushed | already merged)
CI:       <job URL> — <state> (<reason>)
Upload:   <EAS build URL | EAS submission URL + ledger tag>
Track:    internal, draft

Next in Play Console: roll out the internal draft → promote to production → paste notes.
```

---

## Rules

- **Never bump versionCode or versionName yourself.** Report the minimum and let the user
  commit it.
- **Never build or submit locally while `watch` says `EAS_HANDLING`/`EAS_DONE`**, and never
  work around the `build`/`submit` guards. They exist because Play accepts only one upload
  per versionCode.
- **Never force-push `niche/<TAG>-main`**, and never `--no-verify` the merge push.
- **Never delete or move a ledger tag.** If one is wrong, tell the user.
- To backfill a tag for a build already uploaded by hand, confirm the upload with the user
  first, then run
  `git tag -a <brand>-android-vc<N> <merge-sha> -m "<App> <name> (<N>) — uploaded by hand" && git push --no-verify origin refs/tags/<brand>-android-vc<N>`.
- The flagship Therr app releases from `main` (`eas_build_therr_android`), not through this
  skill. A new niche app is one entry in `NICHE_ANDROID_APPS` in
  `_bin/lib/niche-android-release.js`, plus its CircleCI job and EAS profile.
