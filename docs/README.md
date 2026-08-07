# Therr App Documentation

## Repository Overview

This repository is the **core codebase for Therr App**. It contains the main application code, shared libraries, API gateway, microservices, and mobile/web clients.

### Branching Strategy

Various git branches extend from `general` using the naming convention `niche/<niche-tag-name>-general`. These branches represent **variations of the main/core app (Therr App)** and contain configuration differences that allow for developing, building, and publishing app variations to Google Play and the Apple App Store.

| Branch | Purpose |
|--------|---------|
| `general` | Root branch for shared code inherited by all niche apps |
| `niche/<tag>-general` | Niche app variations (e.g., `niche/HABITS-general`, `niche/TEEM-general`) |
| `stage` | Merging `general` → `stage` triggers CI **build** phase |
| `main` | Merging `stage` → `main` triggers CI **deploy** phase to production |

**Important**: Any root or shared code should be committed to `general`, which feeds upstream to `stage`, then to `main`. Merging to `main` triggers new deployments of:
- API Gateway
- Microservices
- Web app for the main/core app (Therr App for web)

## Project Briefs

This section links to project brief documentation for the core app and each niche sub app. The naming convention for niche app briefs matches the git branch tag name.

### Core App
- [PROJECT_BRIEF.md](./niche-sub-apps/PROJECT_BRIEF.md) - Therr App core product vision and roadmap

### Niche Sub Apps
- [HABITS_PROJECT_BRIEF.md](./niche-sub-apps/HABITS_PROJECT_BRIEF.md) - "Friends With Habits" app variation
- [TEEM_PROJECT_BRIEF.md](./niche-sub-apps/TEEM_PROJECT_BRIEF.md) - Teem app variation

## Documentation Index

Every document in this directory, grouped by what you'd be doing when you need it.
Keep this complete — anything not listed here is effectively invisible to both new
contributors and coding agents, which is how more than half of these docs previously
went unread.

### Architecture & platform
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, service boundaries, data layer
- [CROSS_REPO_INTEGRATION.md](./CROSS_REPO_INTEGRATION.md) — the four sibling repos, the tables the Cloud Functions read directly, the habits digest network path
- [MULTI_BRAND_ARCHITECTURE.md](./MULTI_BRAND_ARCHITECTURE.md) — brand variation system, header flow
- [NICHE_APP_DATABASE_GUIDELINES.md](./NICHE_APP_DATABASE_GUIDELINES.md) — schema isolation, migration patterns
- [NICHE_APP_SETUP_STEPS.md](./NICHE_APP_SETUP_STEPS.md) — creating a new brand variation
- [OFFLINE_FIRST_PLAN.md](./OFFLINE_FIRST_PLAN.md) — offline-first architecture and phased roadmap
- [ALGORITHM_AUDIT.md](./ALGORITHM_AUDIT.md) — content ranking and feed algorithm review

### Working here
- [SECRETS_AND_LOCAL_BOOTSTRAP.md](./SECRETS_AND_LOCAL_BOOTSTRAP.md) — local dev setup and secrets
- [WORK_IN_PROGRESS.md](./WORK_IN_PROGRESS.md) — prioritized backlog + manual operational follow-ups
- [PEER_REVIEW_FOLLOWUP.md](./PEER_REVIEW_FOLLOWUP.md) — deferred items from peer reviews
- [FEATURES.md](./FEATURES.md) — feature list for mobile and web (**update when adding/removing features**)
- [MEMORY_SYSTEM_SETUP.md](./MEMORY_SYSTEM_SETUP.md) — the `context/` memory system

### Operations & debugging
- [PROD_DEBUG_CLAUDE.md](./PROD_DEBUG_CLAUDE.md) — production debugging runbook
- [PUSH_NOTIFICATIONS_DEBUGGING.md](./PUSH_NOTIFICATIONS_DEBUGGING.md) — why a push didn't arrive; the diagnostics endpoints, and why a separate Firebase project per brand is usually the wrong fix
- [CLOUDFLARE_CDN.md](./CLOUDFLARE_CDN.md) — CDN configuration
- [AUTOMATION_ROADMAP.md](./AUTOMATION_ROADMAP.md) — cross-repo automation priorities, ranked

### Growth & marketing
- [GROWTH_STRATEGY.md](./GROWTH_STRATEGY.md) — B2B-first funnel; the active growth strategy
- [TARGET_MARKETS.md](./TARGET_MARKETS.md) — consumer and business target markets
- [QR_CODE_MAIL_CAMPAIGN.md](./QR_CODE_MAIL_CAMPAIGN.md) — direct mail campaign
- [PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md](./PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md) — push engagement plan

### Content pipeline
- [CONTENT_GUIDES.md](./CONTENT_GUIDES.md) — editorial guides overview
- [CONTENT_GUIDES_ROADMAP.md](./CONTENT_GUIDES_ROADMAP.md) — roadmap
- [CONTENT_LOCALE_FIRST_PLAN.md](./CONTENT_LOCALE_FIRST_PLAN.md) — locale-first generation
- [CONTENT_MOMENT_DRIVEN_PLAN.md](./CONTENT_MOMENT_DRIVEN_PLAN.md) — moment-driven guides
- [CONTENT_HASHTAG_GUIDES_PLAN.md](./CONTENT_HASHTAG_GUIDES_PLAN.md) — hashtag guides
- [CONTENT_WALKABLE_CLUSTERS_PLAN.md](./CONTENT_WALKABLE_CLUSTERS_PLAN.md) — walkable clusters

### Mobile & migrations
- [RN_NEW_ARCHITECTURE_MIGRATION.md](./RN_NEW_ARCHITECTURE_MIGRATION.md) — React Native new architecture
- [PLAID_REWARDS_IMPLEMENTATION.md](./PLAID_REWARDS_IMPLEMENTATION.md) — Plaid rewards integration

### Niche app design docs
- [niche-sub-apps/habits/](./niche-sub-apps/habits/) — Friends With Habits design docs (9 documents)

## Cross-repo context

Therr spans five repositories. `therr-app` is the product monorepo; the marketing site,
two GCP Cloud Functions, and the Terraform infrastructure live separately. Both Cloud
Functions query this repository's database directly, so schema changes here can break
them with no CI signal in either repo.

Read [CROSS_REPO_INTEGRATION.md](./CROSS_REPO_INTEGRATION.md) before any migration that
renames or drops a column, before adding a table to `BRAND_SCOPED_TABLES`, and before
touching the users-service internal load balancer or NetworkPolicy in `k8s/prod`.

If a `~/Code/therr-workspace` checkout exists locally, its `CLAUDE.md` and
`docs/CROSS_REPO_ARCHITECTURE.md` add the operational/runbook view across all five repos.