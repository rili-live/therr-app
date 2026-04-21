# Locale-First Guides Plan

**Priority:** P1 — start here
**Status:** Planned
**Owner:** Editorial / SEO

## Goal

Publish Spanish and Quebec-French variants of editorial guides for **cities where multilingual long-tail competition is low** (i.e., not Mexico City for `es`, not Montreal for `fr-ca`). Ride the existing `/es/` and `/fr-ca/` URL routing infrastructure to capture queries Yelp and Google have weak coverage for.

## Why this is defensible

- Locale-prefixed URL routing (`/es/guides/<slug>`, `/fr-ca/guides/<slug>`) is already shipped — see `docs/LOCALE_URL_ROUTING.md`.
- The `locales` block already exists in `IPost` (`scripts/generate-content/utils/contentSchema.ts`).
- `resolveGuideForLocale()` already swaps in the localized content at SSR time (`therr-client-web/src/utilities/guideContent.ts`).
- The 3 supported locales (`en-us`, `es`, `fr-ca`) cover ~600M speakers, but most US directories' Spanish/French content is machine-translated boilerplate or absent.
- Therr's locale dictionaries are already maintained in 3 languages — same translator workflow extends to guide content.

## Target market hypothesis

| Locale | Strong target cities | Weak target cities (skip) |
|--------|---------------------|---------------------------|
| `es` | Chicago, Houston, Atlanta, Phoenix, Charlotte | Miami, LA, San Antonio (Yelp es coverage exists) |
| `fr-ca` | Boston, NYC, Burlington VT, Plattsburgh NY (cross-border) | Montreal, Quebec City, Gatineau |

Pick cities where (a) we have strong space coverage and (b) a Spanish- or French-speaking population exists but the major directories haven't invested in localized content.

## Phases

### Phase 1 — verify infrastructure (0.25 day)

**Most of this is already shipped.** Quick verification only:

- [x] `therr-client-web/src/views/guides.hbs` already emits `<link rel="alternate" hreflang="en-US|es-MX|fr-CA|x-default">` (lines 8–11). ✓
- [x] `/sitemap-guides.xml` uses `buildUrlSet()` which emits all three locale URLs with reciprocal hreflang triples per guide. ✓
- [ ] Verify `<html lang="{{htmlLang}}">` is set per-render based on `req.localeFromUrl` — `htmlLang` should come from `getLocaleVars(req)` in `server-client.tsx`. Check by loading `/es/guides/<slug>` and confirming `<html lang="es">` in view-source.
- [ ] Verify canonical URL is the locale-specific URL (not the en-us version) when rendered at `/es/guides/...` or `/fr-ca/guides/...`. May need a small change in `renderGuideView` if canonicalPath is hardcoded to en.

### Phase 2 — locale-aware save-post (0.5 day)

- [ ] Add a `--require-locales <es,fr-ca>` flag to `save-post.ts` that fails validation if the listed locales aren't present in the `locales` block. Used to guarantee a post is multilingual before publishing.
- [ ] Add a per-locale length check: localized `title` ≤ 70 chars, `description` ≤ 165 chars (same SEO limits as default-locale).
- [ ] Add a sanity check that every section in `locales.<X>.sections` has the same `type` order as `sections` (parallel structure required for consistent rendering).

### Phase 3 — translation workflow (1 day)

- [x] Add a `translate-post.ts` script that takes a slug + target locale and outputs a translator-ready prompt (plus `--format source-json` and `--format skeleton` variants) for any LLM / translator. The assistant (Claude) drafts the `locales.<X>` block from the prompt and pipes it to `save-post --require-locales <X>`. ✓
- [x] Documented in `SKILL.md`. No fluent-speaker review gate — Claude-produced translations may ship directly; fixes happen in a refresh if needed. ✓

### Phase 4 — pilot 3 multilingual posts (1 day)

Translate the existing 3 pilot guides into Spanish and French:

| Source slug | Target locales | Reason |
|-------------|----------------|--------|
| `editors-picks-bars-chicago` | `es` | Strong Hispanic population in Chicago, weak es coverage on Yelp |
| `editors-picks-restaurants-portland` | `es` (skip `fr-ca` — weak French speaker base) | Low-hanging |
| `editors-picks-bars-seattle` | `fr-ca` (skip `es` — covered by SF/LA Yelp halo) | Cross-promotes to BC visitors driving down I-5 |

After publishing, GSC should be checked weekly for impressions on the localized URLs over the 30-day window.

### Phase 5 — content selection rules for future locale-first posts

- [ ] Document in `SKILL.md`: when picking a (city, category) combo, also pick which locales to auto-translate. Suggest using a lookup like:
  - Chicago, Houston, Phoenix, Atlanta, Charlotte → always include `es`
  - Boston, NYC, Burlington VT → always include `fr-ca`
  - Mexico City, Montreal → publish ONLY in the local language; skip the en-us doorway page entirely
- [ ] Update the chained workflow: any new post in those cities fails `save-post --require-locales <X>` validation if not translated, forcing the editor to commit to the locale work upfront.

## Success criteria

- 3 multilingual pilots published within 2 weeks of plan kickoff.
- GSC shows impressions on at least one `/es/guides/*` and one `/fr-ca/guides/*` URL within 30 days of publication.
- No hreflang errors flagged in GSC or in https://hreflang.org/ inspector.
- A repeatable "translate + ship" workflow documented in `SKILL.md`.

## Open questions

- ~~Do we accept LLM-assisted translation as a permanent path, or always require a human-fluent reviewer?~~ Resolved 2026-04-19: LLM-produced translations may ship directly; no reviewer gate.
- Should localized `slug`s differ from the en-us slug (e.g., `mejores-bares-chicago`)? Current routing uses one slug across all locales. Worth testing whether Spanish-keyword slugs lift CTR enough to justify the routing change.
- Hreflang for cities where we publish ONLY in `es` or `fr-ca` — is `x-default` then the localized URL, or do we leave the en-us hreflang absent? (Recommendation: emit the localized URL as `x-default` when no en-us version exists.)

## Files this plan touches

- `therr-client-web/src/views/guides.hbs` (hreflang `<link>` tags)
- `therr-client-web/src/server-client.tsx` (`/sitemap-guides.xml` handler — add hreflang triples)
- `scripts/generate-content/save-post.ts` (`--require-locales` flag, per-locale length checks)
- `scripts/generate-content/translate-post.ts` (new)
- `.claude/skills/generate-content/SKILL.md` (locale workflow section)
- `docs/LOCALE_URL_ROUTING.md` (cross-reference if any patterns documented there change)
