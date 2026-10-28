---
name: steward
description: >
  Repo-specific playbook for driving a PR in rili-live/therr-app to green after a
  CI failure, review event, merge conflict or check-in: maps every CircleCI job to the
  local command that reproduces it, says which failures are infrastructure (one re-run)
  versus real (root-cause), lists the known flaky suites, and lists the commands the
  permission classifier blocks so they go to the user as one `!` line instead of being
  retried. Use on any PR you opened or drive, before acting on a red check, and
  whenever a long check run fails and you are about to start it over.
---

# Steward

The harness's PR rules (posture, never-skip-a-test, one re-run at most) still apply.
This file adds what only this repo knows: how its CI is wired, how to reproduce each job
without re-running CI, and which failures have already been seen.

## 1. Read the failure before touching anything

CircleCI reports to GitHub as **commit statuses**, not check runs. Two consequences:

- A status change may not wake the session. Keep the safety-net check-in armed while CI
  runs, and re-read the PR's statuses on every wake rather than waiting for an event.
- The GitHub tools give you the job name and its CircleCI URL, not the log. There is
  no CircleCI token in this harness, so you cannot fetch the log or press "Rerun". The
  route is **reproduce locally** (§2). A re-run is something you ask the user for, once,
  naming the exact job.

Before reproducing, check the base: if the same job is red on the latest `general` commit,
the failure isn't this PR's. Follow the harness's "not this PR's" path.

## 2. Job → local reproduction

Run the narrowest command that reproduces the job. All of these run from the repo root.

| CircleCI job | Runs on | Reproduce locally |
|---|---|---|
| `lint_changed_files` | all but `main` | `./_bin/cicd/lint-changed-files.sh`. It runs `npm run locales:check` and `node scripts/mirrored-files/index.js` before ESLint, so an early failure is translation drift or a mirrored file edited in only one copy. For the ESLint part alone, `npx eslint <files>` |
| `typecheck` | every branch | Run `npm run test:lint-rules` and `npm run test:bin-scripts` first — the job runs them before tsc, so an early failure is usually one of them. Then build `therr-js-utilities` and `therr-react` (`npm run build` in each), then `npm run pr:typecheck:<pkg>`; for mobile, `npm run pr:tsc-baseline:mobile` |
| `test_clients` | every branch | Build the two libraries as above, then `npm test` in `therr-client-web`, `therr-client-web-dashboard`, `TherrMobile` |
| `deploy_pipeline_gates` | every branch | `npm run k8s:check-services && npm run k8s:check-waves && npm run test:bin-scripts && npm run test:harness` (no install needed) |
| `google_ads_tooling_tests` | every branch | `npm run test:google-ads` (needs PyYAML) |
| `test_libraries` | all but `stage`/`main` | `npm test` in `therr-public-library/therr-js-utilities` and `therr-react` |
| `build_and_test_changed_services` | all but `stage`/`main` | `./_bin/apply-to-changed.sh 'npm test' general`. It skips packages that already passed on identical content (§4), so re-running after a fix replays only what's left |
| `test-e2e-critical-path` | feature branches | `./_bin/cicd/setup-test-db.sh && ./_bin/cicd/test-campaign-e2e.sh critical; ./_bin/cicd/teardown-test-db.sh` (Docker) |
| `docker_build_base_image` | all but `main` | Not worth reproducing. It fails on Docker Hub auth or rate limits, not on code |
| `docker_build_test_publish_images` | `stage` only | Never reproduce `publish.sh` locally — it pushes real images. Read `docs/DEPLOY_PIPELINE.md`. Recovery is **re-running the whole stage pipeline, not this job alone** |
| `deploy`, `post_deploy_uat`, `eas_build_therr_android` | `main` only | Never from an agent session |

## 3. Infrastructure or real?

It's infrastructure (worth the one re-run) only when the failure fits one of these:

- Docker Hub login or pull-rate errors, `npm ci` network errors (`ETIMEDOUT`, `ECONNRESET`,
  `EAI_AGAIN`), or the executor dying before any test body ran.
- The same job passed earlier on this exact commit.

Everything else is real. In particular, these looked like infrastructure here once and weren't:

- **`git diff ... HEAD^1 failed`** in a build step: a shallow checkout. `has_diff_changes.sh`
  now deepens and fails open, so a recurrence means a new path bypasses that guard.
- **`docker push` "An image does not exist locally"**: the build step skipped the
  service. The build manifest (`.build-manifest.tsv`) now catches this. Fix the predicate,
  not the push.
- **A service suite that hangs rather than fails**: check Mocha's timeout and the Redis
  teardown first (fixed once on 2026-09-22 in the `.mocharc` and cleanup hooks).

### Known flaky

- **users-service unit**: one unidentified flake, 1 failure in 4 runs (2026-10-12). If it
  fails on a PR that doesn't touch users-service or `therr-js-utilities`, run it locally
  three times. If it passes all three, record the failing test's name (§6) and
  treat it as the one re-run. If you can name the test, making it deterministic within
  the PR is better than a re-run.

## 4. Replay, don't restart

- `_bin/apply-to-changed.sh` (which backs `test:changed`, `lint:changed`, `build:changed` and
  the pre-push hook) records each package that passes, keyed by the command and a hash
  of that package's content and its dependencies. A re-run skips packages already green
  on identical content, so after a fix only the failed package and the ones after it
  run. The last failure is in `$(git rev-parse --git-common-dir)/therr-check-cache/last-failure.json`.
  Read it instead of scrolling back. `THERR_CHECK_CACHE=0` forces a full run.
- For multi-step skills (`/split-branch-prs`, `/niche-android-release`), resume from the run
  ledger (`node scripts/run-ledger/index.js show <skill>`) rather than starting over.

## 5. Commands the permission classifier blocks

These have been refused mid-session before. Don't retry them, and don't reword them to get
past the classifier. Hand the user one `! <command>` line with a one-sentence reason, then
carry on with what doesn't depend on it:

- `kubectl set env`, `kubectl exec` into prod Redis or Postgres, or anything mutating the prod cluster
- `_bin/cicd/run-migrations.sh` against production
- a local `eas build ... --auto-submit` or `eas submit`
- Twilio console or API reads with live credentials
- force-push or remote branch deletion. Ruleset 20514925 ("Prevent branch deletion") also
  refuses these server-side
- committing a file the credential-leak heuristic flags. Check it's really not a secret,
  then ask the user to commit it

## 6. Merge conflicts specific to this repo

- `VERSIONS.txt`: always the `stage` side. Never hand-edit it (CLAUDE.md § Deployment reality).
- `docs/WORK_IN_PROGRESS.md`: keep both sides' sections. Conflicts there are almost always
  two sessions appending follow-ups.
- Locale JSON: keep both keys, then run `npm run locales:check`.
- `package-lock.json`: take the base side, then regenerate it with `npm install`
  (`--legacy-peer-deps` in `TherrMobile`). Never hand-merge it.

## 7. Leave a trail

After each CI failure you root-cause, add one line to today's `context/memory/` log in
exactly this shape, so `/memory-distill` can count repeats across sessions:

```
- CI-failure: <job> | <first error line, ≤100 chars> | <root cause or "infra"> | <fix commit or "re-run">
```

When the same signature shows up a second time, add it to §3 above in the same PR.
