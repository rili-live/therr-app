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

## Technical Documentation

- [Architecture](./ARCHITECTURE.md) - System design, microservices, data layer, and technical decisions
- [Niche App Setup](./NICHE_APP_SETUP_STEPS.md) - Steps to create a new brand variation app

## Guidelines

Write clean code.