# Deploy Pipeline: general → stage → main

How code becomes running production containers, what each stage records, and the
failure modes the pipeline is now built to refuse rather than absorb.

## The two phases

| Branch merge | CircleCI job | What it does |
|---|---|---|
| `general` → `stage` | `docker_build_test_publish_images` | Builds + tests + pushes `therrapp/<svc>-stage:<sha>`, then records what it published in `VERSIONS.txt` |
| `stage` → `main` | `deploy` | Reads `VERSIONS.txt`, retags `-stage` images without the suffix, rolls them out to GKE in waves, runs migrations |

`niche/*` branches never enter this chain. See the branch section of the root
`CLAUDE.md`.

## VERSIONS.txt is a per-service ledger

```
LAST_PUBLISHED_GIT_SHA=<sha>       # most recent stage publish, any service
PUBLISHED_USERS_SERVICE=<sha>      # per-service: the last stage build containing it
PUBLISHED_MAPS_SERVICE=<sha>
...
```

Two rules keep it honest:

1. **Only `publish.sh`, only on `stage`, writes it.** `main` reads it and never
   commits it. One writer means the file cannot diverge between branches, which is
   what removes the merge conflict it used to produce on every back-merge.
2. **A row is written only after both `docker push`es succeed.** A row is a promise
   to the deploy that the tag is pullable.

A service with no row resolves to **nothing**, and is left alone (`unresolved`). It does
*not* fall back to `LAST_PUBLISHED_GIT_SHA`: that field is a watermark meaning "most
recent stage publish, any service", and since `publish.sh` is incremental it gets bumped
by a merge that pushed a single image. Resolving through it points every unrowed service
at a tag that was never built for it — see § The fallback deadlock.

### The ledger also decides what gets built

`build.sh` and `publish.sh` ask `service_needs_build` (`_bin/lib/build-scope.sh`), which
compares each service's sources against **the SHA the ledger records for that service**
— not against `HEAD^1`.

The merge range answers "what did this merge bring in", which is only the right question
while every stage run publishes what it built. When one does not — the run at `a5ce2eee`
aborted in `build.sh` before pushing anything — the merge carrying a service's change
falls behind `HEAD^1` permanently. That service then reads as unchanged on every later
merge, and nothing says so: the build log lists it under "No Changes", the publish log
agrees, and production keeps running the image from before the change.

Comparing against the published SHA converges instead: a service missed by one run is
picked up by the next. It is also one-directional — it can only ever build *more* than
the merge range, never less.

A service with no row, or whose recorded SHA this checkout cannot reach, falls back to
the `HEAD^1` range with a warning saying which.

> Expect the first stage run after a gap to build several services at once. That is the
> ledger reporting real drift — images published before library changes that have since
> landed — not the predicate misfiring.

## What the deploy decides, per service

The deploy is a **desired-state comparison**, not a diff of the merge:

- **desired tag** — the service's row in the ledger
- **running tag** — read off the Deployment in the cluster, before anything is applied
- **roll it** when those differ

The git range still has two jobs, neither of them "should this deploy":

- **staleness** — `git log <desired>..<stage tip> -- <service sources>`. Non-empty
  means the published image predates the code being promoted.
- **severity** — whether the service changed in this merge, which decides if an
  unresolvable version is fatal or just reported.

### Verdicts

| Verdict | Meaning | Effect |
|---|---|---|
| `deploy` | running tag differs, image exists, build is current | rolls |
| `up-to-date` | already on the desired tag | skipped (decided before the registry probe) |
| `behind` | desired tag is an ancestor of the running tag | skipped; `DEPLOY_ALLOW_ROLLBACK=true` forces it |
| `stale-build` | sources changed after the image was published | **blocks** |
| `missing-image` | desired tag is not in the registry | **blocks** |
| `unpublished` | changed in this merge, never published | **blocks** |
| `unresolved` | no published tag, unchanged in this merge | warned, left as-is |

A service that is `up-to-date` but whose *running* image is no longer in the registry
is warned about separately. Nothing is due for it this run, so it does not block — but
the Pod cannot be recreated on a node that has not cached the image, so a node
replacement would strand it. The probe is against the image the Deployment actually
holds, not the `-stage` tag the deploy path would pull: on `main` those differ.

Blocking verdicts stop the run **before any manifest is applied**, and the plan
table is printed either way. When a deploy is refused, the fix is almost always:
re-run the stage pipeline, let it publish, merge the resulting `VERSIONS.txt`
commit into main, re-deploy.

After the rollout, every service the plan said to deploy is re-read from the
cluster and confirmed to be on its desired tag. A service short of it fails the job.

## Why it works this way

The old pipeline was a delta: `git diff HEAD^1` on main picked which services roll,
and a single `LAST_PUBLISHED_GIT_SHA` picked what version. Two halves derived
independently, nothing checking they agreed, and both assuming the previous delta
had been applied in full. Each way that assumption broke left a service stale with a
green build:

- **Two merges to stage before one promotion.** The file held one SHA, so the
  service that published first was pointed at a tag built only for the second. The
  `docker pull` 404'd under `set -e` *mid-loop*, aborting the whole deploy — including
  services whose images were fine.
- **An aborted run.** The services it never reached stayed behind, and the next
  merge's `HEAD^1` range no longer contained their commits, so they were skipped as
  "No Changes" from then on.
- **A fast-forwarded or squashed `stage` → `main`.** `HEAD^1` becomes the previous
  *stage* commit — usually the `[skip ci] Updated VERSIONS.txt` one — so the diff
  showed one file and every service was skipped. Silently, and green.
- **A stage publish that never ran.** The ledger pointed at an older build than the
  code being promoted; the diff said "changed", the pull succeeded, and yesterday's
  image deployed as today's. Nothing looked for this at all.
- **`main` truncating `VERSIONS.txt` and pushing it.** `stage` kept a SHA, `main`
  kept an empty file, and every back-merge carried a conflict on a file nobody edits
  by hand. Resolving one the wrong way re-pointed the next deploy at an arbitrary
  SHA — commit `f038f64`, a mobile fix, restored the truncated file to
  `LAST_PUBLISHED_GIT_SHA=eef996d` as collateral.

Convergence fixes the first four: it does not matter how many merges happened,
what shape the merge was, or whether the last deploy finished — a service behind
its desired tag is simply still behind, and gets picked up. The single writer fixes
the fifth.

## The fallback deadlock

`ledger_resolve` used to fall back to `LAST_PUBLISHED_GIT_SHA` for a service with no
row, to carry the transition from the single-SHA era. That fallback wedged production
for three consecutive promotions, and it is worth understanding because the failure
looked like "deploys stopped working" with nothing obviously wrong.

`publish.sh` is incremental: it pushes only the services whose sources changed in the
merge, then bumps `LAST_PUBLISHED_GIT_SHA` regardless. So one stage merge touching one
service pushed one image and simultaneously re-pointed the other seven at that new SHA:

```
stage merge  users-service changes  -> pushes therrapp/users-service-stage:A
                                       writes LAST_PUBLISHED_GIT_SHA=A
stage -> main                       -> maps-service has no row, resolves to A,
                                       therrapp/maps-service-stage:A never existed
                                    -> missing-image -> BLOCKS the whole deploy
```

The plan's `up-to-date`-before-the-registry-probe ordering was meant to absorb this, on
the reasoning that an unrowed service is "already running exactly the right image". That
only holds while the cluster's running tag equals the watermark — and it never did. When
the ledger landed the watermark was `3f1d5ba` while the cluster was on `eef996d`, so
every service fell straight through to the probe.

It also **ratchets**. The natural way to force a deploy — touch one service's README and
promote it — publishes that one service and moves the watermark to a *newer* absent tag
for the other seven. Every retry widened the gap. Re-running the stage pipeline could not
fix it either, because a re-run republishes only the services that changed in that merge.

Now a row is the only thing that resolves. A row is a promise, made by `publish.sh` only
after both pushes succeed; absent a row there is no promise and the plan does not invent
one. Unrowed services land on `unresolved` (warn, left as-is) or, if the merge did carry
their work, `unpublished` (blocking) — which is correct, because that genuinely is a
promotion dropping work.

### Giving every service a row

A service earns a row the next time its sources change and `stage` publishes it. To
repopulate the whole ledger deliberately, change `global-config.js`: it is in every
service's source fan-out in `_bin/lib/service-registry.sh`, so one commit through
`general` → `stage` rebuilds and publishes all eight and writes eight rows at one SHA.
That is the supported way to resynchronise a cluster that has drifted behind the ledger.

Never hand-edit `VERSIONS.txt` to do it.

## build.sh hands publish.sh a manifest

Both scripts run as steps of the one `docker_build_test_publish_images` job, over one
checkout. They used to answer "should this service ship?" separately, by each
evaluating the changed-files predicate — two evaluations of one question, with nothing
positioned to notice when they disagreed.

They did disagree, on the stage merge at `e4790de8`. `build.sh` skipped all eight
services as "No Changes" and went green; `publish.sh` found `therr-client-web` changed
and pushed a tag nothing had built. The job died four steps later at `docker push`:

```
The push refers to repository [docker.io/therrapp/client-web-stage]
An image does not exist locally with the tag: therrapp/client-web-stage
```

A message about the registry, for a fault in the build step, which reported success.

Now `build.sh` writes `.build-manifest.tsv` — one row per image it built, `key`,
`:latest` tag, `:<sha>` tag — and `publish.sh` pushes that list. Three consequences:

- **An absent manifest is a hard error**, not an empty publish: the file is truncated
  before the build loop, so "exists but empty" means *built nothing* and "absent" means
  *the build step never ran*. The recovery is re-running the whole stage pipeline, not
  this job alone.
- **The predicate stays in `publish.sh` as a cross-check only.** If it says a service
  should have shipped and the manifest doesn't carry it, publish fails naming both
  steps, instead of failing at the registry.
- **The ledger row is taken from the tag that was pushed**, not from `GIT_SHA`, so a
  row cannot name a tag the push never sent.

Both scripts also `docker image inspect` each tag before relying on it. A `docker
build` that exits 0 without loading its tags is not hypothetical — under a buildx
container driver the result stays in the build cache unless `--load` is passed, and
the only symptom is a push that cannot find the image.

### Why a git failure can no longer read as "no changes"

The predicate in `_bin/lib/has_diff_changes.sh` counted with
`NUM=$(git diff ... | wc -l)`. A pipeline reports its *last* element's status, so git
dying — an unresolvable rev, a missing object, a shallow or partial checkout —
produced zero lines, and `[[ 0 -gt 0 ]]` is false. "git could not tell us" and
"nothing changed" were the same answer.

`_count_diff_files` now checks git's own exit status and aborts the script, leaving
git's message in the job log. That is what turns the failure above into a red *build*
step naming the real cause. `setup_remote_docker` is also pinned rather than left to
CircleCI's moving default, so the executor is one less thing that changes underneath
a green pipeline.

### …and why a missing commit no longer stops the deploy either

The rule is "an unanswerable diff must never read as *no changes*" — which is not the
same as "must abort". The stage merge at `a5ce2eee` aborted the build step with
`git diff --name-only HEAD^1 -- therr-client-web failed`, because CircleCI had handed
that job a shallow clone: on `stage`/`main` the predicate compares against HEAD's first
parent, and in a depth-1 clone HEAD has no parent locally. Nothing was wrong with the
merge, and nothing about the code could fix it.

So `prev_tip()` now deepens the checkout by one commit and asks again (`_deepen_once`,
a no-op on a full clone, recorded in the git dir so the eight services do not each pay
for a fetch). Only when the parent is still unreachable does the predicate **fail
open** — reporting the path as changed, with a warning saying so. Building a service
that did not change costs one job; skipping one that did costs a deploy. The same
fallback covers the feature-branch path when `git merge-base` has no common ancestor to
find.

`_count_diff_files` keeps its abort for the other case: a diff git *could* answer and
did not.

## The service registry

`_bin/lib/service-registry.sh` is the one list `build.sh`, `publish.sh`,
`deploy.sh` and `run-migrations.sh` iterate. Each row carries the image repo, the
Deployment and container names, the Dockerfile and build context, and the full
source fan-out (the service directory *plus* the libraries compiled into its image
*plus* `global-config.js`).

It replaced four hand-maintained lists that had to agree with each other, with
`k8s/prod`, and with the rollout wave plan — with nothing checking that they did. A
service present in `build.sh` and `publish.sh` but missing from `deploy.sh` built and
published on every stage merge and then never deployed, and the log said nothing.

`assert_service_registry` runs at the top of all three CI scripts and fails on:

- a Deployment named with no manifest, or a container name the manifest doesn't define
- a `therrapp/` Deployment in `k8s/prod` with no registry row
- a Dockerfile or source path that doesn't exist
- a row that doesn't lead its sources with the service's own directory — `service_dir`
  reads it from there, and `run-migrations.sh` builds `<dir>/src/store/migrations`
- `THERR_MIGRATABLE_SERVICES` naming a key that isn't in the registry, or one whose
  `src/store/migrations` directory doesn't exist

### Adding a service

1. Add its row to `THERR_SERVICES`.
2. Add its Deployment to a wave in `_bin/lib/rollout-waves.sh` (wave 1 unless it
   serves browsers directly).
3. `npm run k8s:check-services && npm run k8s:check-waves && npm run test:bin-scripts`

## Migrations

`run-migrations.sh` runs `migrate:latest` inside the freshly rolled-out pod, for
services whose `src/store/migrations` changed **across the version range the service
actually moved through** — read from the plan `deploy.sh` writes, not from the merge
diff. A migration missed by a skipped deploy is therefore picked up by the next one,
which the `HEAD^1` range could not do. Expand/contract only; `RUN_MIGRATIONS_ON_DEPLOY=false`
opts out.

## Environment overrides

| Variable | Default | Effect |
|---|---|---|
| `DEPLOY_ALLOW_ROLLBACK` | unset | Allows a `behind` verdict to deploy |
| `DEPLOY_ROLLOUT_TIMEOUT` | `360s` | Per-Deployment `rollout status` timeout |
| `DEPLOY_DRAIN_TIMEOUT` | `0` | Seconds to wait for superseded pods between waves |
| `RUN_MIGRATIONS_ON_DEPLOY` | unset | `false` skips automated migrations |
| `GKE_CLUSTER` / `GKE_ZONE` / `GKE_PROJECT` | `therr-prod-1` / `us-central1-a` / `therr-app` | Cluster cutover without a code merge |

## Local checks

```bash
npm run k8s:check-services   # registry vs k8s/prod
npm run k8s:check-waves      # wave plan vs k8s/prod
npm run test:bin-scripts     # ledger, verdicts, git-range and registry tests
npx eslint _bin --ext .js    # _bin/.eslintrc.js covers these; there is no root config
```

All three `npm` checks run in CI on every branch, as the `deploy_pipeline_gates` job.
