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

A service with no row falls back to `LAST_PUBLISHED_GIT_SHA`. That fallback is what
carries the transition from the old single-SHA format, and is the honest answer for
an image that predates the ledger.

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

## One-time transition

One thing carries over from the truncating era:

**No service has a per-service row yet.** Every service resolves through
`LAST_PUBLISHED_GIT_SHA` on the first deploy, and rows accumulate from the next
stage publish onward.

That fallback is not quite "the same behaviour as the old script", and the
difference matters once: the old script only pulled images for services the merge
diff named, whereas the plan now resolves a desired tag for **every** service. A
`LAST_PUBLISHED_GIT_SHA` was only ever pushed for the services that publish actually
rebuilt, so on the first deploy the other services point at a `-stage` tag that was
never created. They are already running the right image, so they come out
`up-to-date` and are skipped — but only because `up-to-date` is decided ahead of the
registry probe (see `plan_verdict`). Any of them that the cluster *is* behind on will
come out `missing-image` and block; the fix is the ordinary one — re-run the stage
pipeline so it publishes and writes rows.

`general`, `stage` and `main` currently all hold the same
`LAST_PUBLISHED_GIT_SHA`, so no branch has a stale copy and no merge in either
direction has anything to resolve on this file.

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
- `THERR_MIGRATABLE_SERVICES` naming a key that isn't in the registry

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
```
