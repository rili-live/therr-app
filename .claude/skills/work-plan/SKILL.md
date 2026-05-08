---
name: work-plan
description: Read docs/WORK_IN_PROGRESS.md and propose a contained, near-term batch of highest-priority items to tackle next. Reconciles tier priority with the current git branch's deploy reality, surfaces unchecked Manual Operational Follow-ups, clusters related TODOs into one coherent commit/PR, and either starts implementation or asks the user the few decisions needed first.
user-invocable: true
allowed-tools: Bash(git branch*), Bash(git status*), Bash(git log*), Bash(git diff*), Bash(git fetch*), Bash(git rev-list*), Bash(git merge-base*), Bash(grep*), Bash(rg*), Bash(find *), Read, Glob, Grep, AskUserQuestion
argument-hint: [--tier <1-5>] [--niche <TAG>] [--ops-only] [--dry-run]
---

# Work Plan

Propose the next contained batch of work to take on, grounded in
`docs/WORK_IN_PROGRESS.md`, the current git branch, and what can actually ship
soon. The output is **a plan, not code** — Claude only starts editing after the
user approves the batch (or `--dry-run` is omitted and there are no open
questions).

The point of this skill is to:

1. Surface the **highest-value** unchecked work without re-reading the whole
   backlog every time.
2. **Right-branch** the batch — never propose backend/shared-library changes on
   a niche branch, and never propose niche-specific changes on `general`.
3. **Cluster** items that share files, ticket prefixes (`RSERV-`, `RFRONT-`,
   `RMOBILE-`, `RDATA-`), or the same migration/store, so one sitting closes a
   coherent slice instead of pecking at unrelated TODOs.
4. **Prefer ops follow-ups** when they are blocking the value of recent code
   work (e.g. unrun migrations make brand-isolation reads return zero rows).
5. Stop at a small, reviewable scope — typically 3–6 items, ≤ ~300 LOC, one
   PR's worth.

---

## Argument summary

| Argument | Effect |
|----------|--------|
| _(no argument)_ | Default flow — analyze branch, propose one batch, start after approval |
| `--tier <1-5>` | Restrict candidate items to the given tier (default: lowest tier number with open items that fits the branch) |
| `--niche <TAG>` | Bias toward items relevant to a niche app (e.g. `HABITS`, `TEEM`). Only meaningful from `general` — flags niche-affecting shared work |
| `--ops-only` | Only consider Manual Operational Follow-ups; skip the TODO backlog |
| `--dry-run` | Print the plan and stop. Do not start implementation even if approved |

---

## Step 1: Branch + deploy snapshot

Run in parallel:

```bash
git branch --show-current
git status --short
git log --oneline -5 --no-merges
git fetch origin general stage main 2>/dev/null
```

Then compute, also in parallel where independent:

```bash
git rev-list --count origin/general..origin/stage 2>/dev/null   # commits queued for build
git rev-list --count origin/stage..origin/main 2>/dev/null      # commits queued for deploy
git rev-list --count origin/general...HEAD 2>/dev/null          # divergence from general
```

Classify the current branch using the same rules as `branch-guard`:

- **Niche** — `niche/<TAG>-general`. Pull `<TAG>` for downstream filtering.
- **Shared** — `general`, `stage`, `main`.
- **Feature** — anything else (e.g. `claude/...`, `feat/...`). Determine intended
  merge target from divergence and from naming. When unclear, ask the user
  with `AskUserQuestion`.

This step also tells the user what's currently in flight:

> "stage is 4 commits ahead of general (queued to build); main is 0 commits
> behind stage. You're on `general` — new work here will join the next build
> cycle."

If the working tree is dirty, **stop and ask** whether to plan around the
dirty state, stash it, or abort. Do not proceed silently.

---

## Step 2: Read the backlog

Read `docs/WORK_IN_PROGRESS.md` once in full. Extract:

- The **§ Manual Operational Follow-ups** list, separating standing items,
  pending campaigns, and the auto-appended skill-followups block (between
  the `<!-- skill-followups:start -->` and `<!-- skill-followups:end -->`
  markers). Note each unchecked item (`- [ ]`) and its date if present.
- The **TODO Backlog by Business Value** sections (Tier 1 → Tier 5). For each
  bullet, capture the source path:line and the one-line description.

Also read `docs/PEER_REVIEW_FOLLOWUP.md` if it exists — items there are
narrower-scope but often share a deploy with current `general` work and may be
the right next batch. Treat its items as candidates alongside the backlog.

---

## Step 3: Filter candidates by branch fit

Apply the **must-be-on-general** rules from `CLAUDE.md` to every candidate
TODO. A candidate's path determines whether it can land on the current branch:

**Must-be-on-general paths** (drop these from the candidate list when on a
`niche/*` branch):

- `therr-services/**`
- `therr-api-gateway/**`
- `therr-public-library/**`
- `**/migrations/**`, `**/*.sql`
- Root `package.json`, `package-lock.json`, `docker-compose*.yml`, `_bin/**`

**Niche-eligible paths** (drop these from the candidate list when on `general`
unless the change is genuinely cross-brand):

- `TherrMobile/main/config/brandConfig.ts`
- `TherrMobile/main/assets/**` (brand asset trees)
- Brand-only screens / niche app store metadata

**Both-eligible paths** (kept regardless of branch — flag the right target on
the plan):

- `TherrMobile/main/routes/**`, `TherrMobile/main/components/**` (most are
  shared; some are niche-only — judge per file)
- `therr-client-web/**`, `therr-client-web-dashboard/**`
- `TherrMobile/main/locales/**` (always shared)

When `--niche <TAG>` is set on `general`, give a **bias bonus** (not a hard
filter) to items whose description references that niche or whose project
brief lists them as blockers. Look at
`docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` for that brief's roadmap items.

---

## Step 4: Score and cluster

For each surviving candidate, compute:

- **Tier weight** — 5 for Tier 1, 4 for Tier 2, ..., 1 for Tier 5.
- **Cluster signal** — count of other candidates that share a directory
  prefix, the same ticket prefix (`RSERV-N`, `RFRONT-N`, `RMOBILE-N`,
  `RDATA-N`), or the same store/handler file. Higher cluster signal means a
  better one-sitting batch.
- **Effort proxy** — bullet language. Heuristics:
  - "Wrap in soft opt-in UX", "Implement prediction algorithm", "ML to
    predict" → **L** (multiple sittings; usually decline as a batch).
  - "Use constants instead of magic strings", "Cache signed-URL responses",
    "Add error message", "Replace alert with toast" → **S**.
  - Most items default to **M**.
- **Blocking ops follow-up** — if a Tier 1/2 item depends on a manual op
  step (e.g. a migration run) that is still unchecked, demote the code item
  and surface the ops step instead. Running an unran migration unlocks the
  code work that already shipped; that almost always beats writing more code.

Pick a **target tier**: the lowest-numbered tier that still has at least 3
branch-eligible candidates. If `--tier <N>` is set, use it directly even if
sparse.

Build candidate **batches** from clusters within the target tier:

- A batch is 3–6 items that touch overlapping files / share a ticket prefix.
- Reject batches that mix backend and frontend in a way that violates the
  "Commit separation (non-negotiable)" rule in `CLAUDE.md` — a single batch
  must be landable on a single branch.
- Prefer batches whose items reference the same store, handler, or feature
  area. Example good batches:
  - All five `eventReactions` / `momentReactions` / `spaceReactions` /
    `thoughtReactions` "secure endpoint" items together (one PR).
  - All `firebaseAdmin.ts` brand-isolation items together.
  - All four "hard limit on reaction-count fetch" store items together.

Pick the **single best batch**. If two are tied, pick the one whose paths
overlap with files that are already in the staged/unstaged diff, or whose
tier is lower (more revenue-blocking).

---

## Step 5: Surface ops follow-ups

Before reporting the batch, scan unchecked Manual Operational Follow-ups for
items that:

- Reference recent code merged into `general` / `stage` (look at
  `git log origin/main..origin/general --oneline` for context).
- Block the **value** of recent or proposed code work (e.g. a migration that
  makes a brand-isolation column NOT NULL DEFAULT — the code reads it and
  500s until the column exists).
- Are time-sensitive (sitemap re-submission after route changes, SES
  warmup, CDN invalidation after asset changes).

Pick at most **3** of these to surface — do not dump the whole list. If
`--ops-only` is set, skip Step 4 entirely and surface only ops items.

---

## Step 6: Produce the plan

Print a single, scannable plan. Format:

```
Work Plan — <branch> (<branch-classification>)

Deploy state:
  general → stage:  <N> commits queued for build
  stage   → main:   <M> commits queued for deploy
  HEAD vs general:  <K> commits diverged

Pending ops follow-ups (top 1–3, related to current state):
  [ ] (YYYY-MM-DD) <action>
        why now: <one line — what it unblocks>
        risk if skipped: <one line>

Proposed batch — Tier <N>: <theme/cluster name>
  Branch fit: <on this branch> | <must move to general first> | <split commit>
  Effort:     <S | M | L> · ~<estimated LOC range>
  Items:
    1. <path:line> — <description>
    2. <path:line> — <description>
    3. <path:line> — <description>
    ...

Why this batch (near-term value):
  - <one sentence: how it moves the needle on revenue / growth / risk>
  - <one sentence: which downstream items it unblocks (if any)>

Explicitly out of scope (do not include now):
  - <related-but-bigger item the user might expect>: <one-line reason to defer>
  - <stale or noisy item>: <reason>

Open questions before I start:
  Q1. <only the questions whose answers change the plan; e.g.
       "These reaction endpoints are also called by the public web embed —
        require auth, or accept signed payloads instead?">
  Q2. <only if non-obvious>
```

Do not include questions whose answer is already determinable from
`CLAUDE.md`, the project briefs, or the file's own comments — that is busy
work for the user. If there are no open questions, say so:

> "No open questions — approve and I'll start."

---

## Step 7: Decide whether to ask or start

After printing the plan:

- **If `--dry-run`**: stop. Do not proceed to implementation.
- **If there are open questions**: use **`AskUserQuestion`** for at most the
  top 2–3 questions. Each question's options must be concrete (not "yes/no")
  — list the actual approaches with their trade-offs. Wait for answers
  before continuing.
- **If branch fit says "must move to general first"**: ask whether to switch
  to `general` (and offer the `branch-guard switch` flow), abort, or
  reframe the plan to a different batch that fits this branch.
- **Otherwise**: ask one final confirmation:
  > "Approve to start this batch? (yes / refine / pick a different batch)"
  Begin editing only on explicit approval.

---

## Step 8: Implement (only after approval)

Once approved:

1. **Update the backlog** in the same session: when each TODO is fixed,
   delete its bullet from `docs/WORK_IN_PROGRESS.md` (and remove the
   corresponding `// TODO` comment in source) per the "When closing a
   TODO in code" rules in that file. This must happen in the same commit as
   the fix.
2. **Respect commit separation** — if the batch genuinely needs both
   backend and frontend (rare, see above filter), produce two commits on
   two branches per `CLAUDE.md`'s "Commit separation (non-negotiable)"
   rules. Never bundle them.
3. **Run `quality-check`** after edits, before declaring the batch done.
4. **Append new ops follow-ups** to the `<!-- skill-followups:start --> ...
   <!-- skill-followups:end -->` block if the batch creates a post-deploy
   step (e.g. a new migration that needs `npm run migrations:run`).

Do not commit or push automatically — leave that to the user unless they
have already approved a commit explicitly.

---

## Rules

- **Plan first, code second.** Even when the user implies "just do it", print
  the plan first; it costs ~10 seconds and protects against scope creep.
- **One batch at a time.** Do not propose two batches in parallel — pick one.
  Mention deferred batches in "Explicitly out of scope" so they're visible
  but not started.
- **Never propose a batch that violates branch placement rules.** If
  every Tier 1 item is must-be-on-general but the user is on a niche branch,
  the right plan is to switch branches, not to compromise the placement.
- **Prefer items whose path is already touched** in the working tree — if the
  user is mid-edit on `firebaseAdmin.ts`, batch the firebaseAdmin TODOs and
  skip the unrelated reaction-store items.
- **Do not invent priorities.** The tier comes from the file. If you think a
  Tier 4 item should be Tier 1, say so in "Why this batch", but do not
  silently re-rank the file.
- **No new files unless required.** This skill plans edits to existing files
  by default; new files (migrations, tests for a bugfix) are allowed only
  when the batch's items explicitly call for them.
- **Keep the report short.** A good plan fits on one screen. Long plans are
  warning signs that the batch is too big.
