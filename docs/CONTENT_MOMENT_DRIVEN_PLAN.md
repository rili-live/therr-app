# Moment-Driven Freshness Plan

**Priority:** P2
**Status:** Planned
**Owner:** Editorial / SEO

## Goal

Generate guides (or refresh existing ones) that quote **recent user-generated `moments`** at featured spaces — caption + author handle + photo + date. First-party UGC nobody else has, plus the recency signal lifts SERP rank.

## Why this is defensible

- Yelp has reviews; Google has photos. Neither has *current* short-form local UGC tied to a specific place. Therr's `moments` are exactly this.
- Recency signals (fresh content, recent dates) are a known SEO lift — if the page legitimately updates monthly with new quotes, it stays fresh without manual rewrites.
- Quoting real user voice strengthens E-E-A-T (Experience signal in Google's quality framework).

## Phases

### Phase 1 — moments schema discovery (0.5 day)

- [ ] Inspect `main.moments` schema (or whatever the table is called — verify with `\d` in psql or by reading the `messages-service` migrations). Capture: id, caption/message field, mediaIds, userId, spaceId / latitude+longitude, createdAt, isPublic, hashtags.
- [ ] Confirm a foreign key or proximity link exists between moments and spaces — moments may not be hard-linked to a space; they may be lat/long anchored. If proximity-only, define the matching rule (within X meters of the space's lat/long).
- [ ] Confirm there's a `userId`/handle field accessible without exposing PII; if only `userId` is there, plan for a join to `users` for handle/displayName.

### Phase 2 — privacy and consent (0.5 day) — DO NOT SKIP

- [ ] Confirm whether public moments imply consent to attributed quotation in editorial content. Read the Therr ToS / privacy policy. If unclear, get product/legal sign-off before any content publishes.
- [ ] Decide attribution policy: full handle, handle with link, first-name only, or anonymized ("a Therr user"). Default recommendation: full handle with link to their profile, with an opt-out flag in the user settings (default: opt-in for public moments).
- [ ] Add a per-user opt-out field if it doesn't exist (e.g., `users.editorialUseOptOut` boolean). Respect it in every query.

### Phase 3 — query script (0.5 day)

- [ ] Build `scripts/generate-content/query-recent-moments.ts` — given a `--spaceId <id>` (or `--city <slug>`), returns the most recent N public moments at/near that space, with caption, author handle, mediaIds, createdAt.
- [ ] Apply quality filters: caption length ≥ 20 chars, no all-caps, no obvious spam patterns (the same SEO-spam regex from the curated query).
- [ ] Auto-redact handles for users with `editorialUseOptOut = true`.

### Phase 4 — schema + new section type (0.5 day)

- [ ] Add a `moment-quote` section type:
  ```ts
  { type: 'moment-quote'; momentId: string; caption: string; authorHandle: string | null; authorUrl?: string; mediaUrl?: string; createdAt: string; spaceId?: string; }
  ```
- [ ] Mirror in `guideContent.ts`.
- [ ] Update `validatePost`.

### Phase 5 — frontend rendering (1 day)

- [ ] Build `therr-client-web/src/routes/Guide/sections/MomentQuote.tsx` — blockquote-style card with caption, author byline, optional photo thumbnail, link to the full moment page (`/moments/<id>`), date.
- [ ] Add JSON-LD: nest each moment as a `Comment` within the parent Article schema's `comment` array, OR as a separate `SocialMediaPosting` schema (newer, better-supported).

### Phase 6 — refresh integration (0.5 day)

- [ ] Extend `refresh-post.ts` with a `--refresh-moments` flag: re-pulls fresh moments for every space referenced in the post, replaces stale `moment-quote` sections, bumps `updatedAt`. Run monthly via cron or manual trigger.
- [ ] Cap moments per post (e.g., 8) to avoid bloat.

### Phase 7 — pilot 2 moment-driven posts (1 day)

- [ ] Take an existing curated guide (e.g., `editors-picks-bars-chicago`) and add a `moment-quote` section per featured space — should produce 4–8 quoted moments scattered through the post.
- [ ] Generate one new guide that's *primarily* moment-driven: "What people are sharing in [neighborhood] this month" — a feed-style guide pulling 8–10 recent moments from a single neighborhood.

## Success criteria

- 2 pilot posts include verified moment quotes with proper attribution.
- `--refresh-moments` runs cleanly and bumps `updatedAt` without breaking the schema.
- No user-reported privacy concerns within 30 days of publication.
- GSC shows the pages re-crawled within 7 days of each refresh (recency signal landing).

## Open questions

- **Privacy model is the biggest unknown.** Resolve it before any code. If we can't get clear opt-in, we may need to anonymize (which weakens the E-E-A-T benefit but stays safe).
- Should moment-driven posts be a *post type* (`type: 'feed'`) or just a *section* in any post? Probably both — make it a section first, evolve into a type if usage warrants.
- Photo rights: we display moments inside the app under the user's content rights, but does external SEO display fall under the same license? Verify with whoever owns ToS.
- Stale-moment handling: if a featured moment is deleted by its author, how do we propagate the deletion to the static guide JSON? (Recommendation: every `--refresh-moments` run also re-validates that each existing moment is still public and still exists.)

## Files this plan touches

- `scripts/generate-content/query-recent-moments.ts` (new)
- `scripts/generate-content/refresh-post.ts` (`--refresh-moments` flag)
- `scripts/generate-content/utils/contentSchema.ts` (`moment-quote` section)
- `therr-client-web/src/utilities/guideContent.ts` (mirror schema)
- `therr-client-web/src/routes/Guide/sections/MomentQuote.tsx` (new)
- `therr-client-web/src/utilities/guideJsonLd.ts` (`Comment` or `SocialMediaPosting` nesting)
- `.claude/skills/generate-content/SKILL.md` (Mode 7: Moment-driven post)
- Possibly `users` schema migration for `editorialUseOptOut`
