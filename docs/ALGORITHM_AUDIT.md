# Therr Content–Preference Algorithm Audit

**Date:** 2026-07-26
**Scope:** How user preferences are captured, stored, and used to select and order content across all four personalization surfaces.
**Status:** Audit only — no behavioral code changed. All remediation described here touches `therr-services/**` and `therr-public-library/**`, so it **must land on `general`**, never a `niche/*` branch (see `CLAUDE.md` § Deployment reality).

---

## 1. Inventory — what "the algorithm" actually is

There is no single ranker. There are four independent surfaces, only one of which is genuinely personalized, and they share no scoring code.

| # | Surface | Entry point | Preference-aware? | Geo-aware? |
|---|---------|-------------|-------------------|------------|
| 1 | **Thought distributor** (stream activation) | `users-service/src/api/TherrEventEmitter.ts` → `ThoughtsStore.getRecentThoughts` | Yes (boolean interest filter) | **No** |
| 2 | **Map content search** (moments / spaces / events) | `maps-service/src/store/{Moments,Spaces,Events}Store.ts` → `search*` | **No** | Yes (`ST_DWithin` + `ST_Distance ASC`) |
| 3 | **Activity Generator** (group meetup suggestions) | `maps-service/src/handlers/activities.ts` → `SpacesStore.searchRelatedSpaces` | Yes (ranked, group-intersected) | Yes |
| 4 | **Preference learning loop** | `{maps,reactions}-service/src/utilities/incrementInterestEngagement.ts` → `users-service` `POST /users/interests/increment` | — (this *is* the model) | No |

### The data model

`main.interests` — static taxonomy (`tag`, `categoryKey`, `displayNameKey`, `emoji`), seeded from `users-service/src/store/seeds/001_interests.js`.

`main.userInterests` — the entire user preference model, three columns wide:

```js
// 20240429134308_main.userInterests.js
table.integer('score').notNullable().defaultTo(5);           // "1 - 5 where 1 is the highest"
table.integer('engagementCount').notNullable().defaultTo(0);
table.bool('isEnabled').notNullable().defaultTo(false);
```

Content side: `interestsKeys jsonb` on `main.moments`, `main.spaces`, `main.events` (maps-service) and `main.thoughts` (users-service), each with a GIN index (`idx_*_interests_keys`, default `jsonb_ops` — correctly supports the `?|` operator used at query time).

The one place the two sides are combined into a number:

```ts
// users-service/src/handlers/userConnections.ts:29
const getInterestRanking = (engagementCount: number, score: number) =>
    Math.ceil((engagementCount || 1) / (score || 5));
```

---

## 2. Effectiveness findings

### E1 — The declared-preference dimension is inert

`score` is documented as "1–5 where 1 is the highest" and defaults to `5` (the *lowest* priority). Nothing ever writes a different value:

- `CreateProfileInterests.tsx:87-102` builds `{ interestId, isEnabled }` — **no `score` field**.
- `ManagePreferences.tsx` likewise sends no score.
- `therr-api-gateway/src/services/users/validation/` has no `userInterests` validator at all, so the field is unvalidated pass-through.

Every row in production therefore has `score = 5`, and `getInterestRanking` degenerates to `Math.ceil(engagementCount / 5)`. The user's *stated* preferences contribute exactly zero to ranking; only implicit behavior does.

Two follow-on defects in the same code path:

- `Math.ceil(... / 5)` quantizes hard. Engagement counts 1–5 all produce ranking `1`; 6–10 all produce `2`. The `|| 1` on `engagementCount` means a never-engaged interest ties with one engaged five times. Most users' interests are all tied at rank 1.
- `UserInterestsStore.create` does `score: Math.min(param.score || 5, 5)` — it clamps the top but not the bottom, and `param.score || 5` silently rewrites a legitimate `0` to `5`.

### E2 — Behavior cannot discover new interests

```ts
// UserInterestsStore.incrementUserInterests
.increment('engagementCount', incrBy)
.where({ userId })
.whereIn('interestId', (b) => b.select('id').from(INTERESTS_TABLE_NAME)
    .whereIn('displayNameKey', interestDisplayNameKeys))
```

This is an `UPDATE`, not an upsert. If no `userInterests` row exists for that `(userId, interestId)` pair, the signal is silently discarded — the handler still returns 200.

Onboarding happens to insert rows for *all* interests (enabled and disabled), which papers over this for users who complete onboarding. But it produces a second problem: engagement accrues on interests the user explicitly **disabled**, and there is no path that ever surfaces that ("you keep opening coffee content — re-enable coffee?"). For users who skip onboarding, sign up via SSO, or predate the interests feature, the model never learns anything at all, permanently.

### E3 — No decay and no normalization

`engagementCount` is monotonically increasing with no half-life, no recency weighting, and no per-user normalization. Consequences:

- A user's ranking is frozen around whatever they did in their first weeks. A newly acquired interest can never overtake an old one within any realistic session count.
- In `getTopRankedConnections`, rankings from different users are summed directly (`ranking: (existing.ranking || 0) + u.ranking`). Heavy users' interest vectors dominate the group intersection purely because they have more raw engagement, not stronger preference.

### E4 — Interest matching is an unweighted boolean OR

Every content query uses the same shape:

```ts
query.whereRaw(`"interestsKeys" \\?| ARRAY[${placeholders}]::text[]`, relatedInterestsKeys);
```

`?|` is "overlaps with any". Matching 1 of a user's 30 interests scores identically to matching 8 of their top 8. Worse, the distributor discards its own ranking before querying:

```ts
// TherrEventEmitter.ts:29-30 — every enabled interest, flat, engagementCount ignored
const interestsKeys = contextUsers.reduce((acc, cur) =>
    [...acc, ...(cur?.userInterests || []).map((i: any) => i.displayNameKey)], []);
```

`findUsersWithInterests` selects `score` and `engagementCount` and the distributor throws both away. For an engaged user with many interests, the filter's selectivity approaches zero — it's equivalent to no personalization.

### E5 — Relevance is computed, then discarded before the user sees it

`getRecentThoughts` does real ranking work — a Hacker-News-style hot score with a deliberately benchmarked correlated subquery:

```sql
ORDER BY ("replyCount" + 1) / POWER((EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600) + 2, 1.5) DESC
```

That score decides *which* thoughts get activated. It is then thrown away. Activation writes `thoughtReactions` rows via `createReactions`, and the read path (`ThoughtReactionsStore.get`) orders by the **reaction's** `createdAt`:

```ts
.limit(restrictedLimit)
.orderBy('createdAt', filters.order)
```

A distributor run activates 7–20 thoughts (`randomIntFromInterval(7, 20)`) in a single batch with effectively identical timestamps. Intra-batch order is arbitrary. **No column anywhere persists the relevance score**, so the user's feed is ordered by activation batch, not by relevance.

The direct search path is worse — `ThoughtsStore.search` has no `ORDER BY` at all, with the reason in a comment:

```ts
// TODO: Determine a better way to select thoughts that are most relevant to the user
// .orderBy(`${THOUGHTS_TABLE_NAME}.updatedAt`) // Sorting by updatedAt is very expensive/slow
```

Postgres returns rows in whatever order the plan yields, and pagination over an unordered query can repeat and skip rows.

### E6 — The personalized surface has no geography; the geographic surface has no personalization

This is the central structural gap in a location-based product.

- The thought distributor applies **no location filter whatsoever**. A user in Chicago is served the globally-hottest interest-matching thoughts.
- `searchMoments`, `SpacesStore.searchSpaces`, and `searchEvents` **never reference `interestsKeys`**. Their ordering is strictly `ST_Distance(...) ASC` (or `createdAt DESC` with no coordinates), inside a 1 km default radius (`Location.AREA_PROXIMITY_METERS = 1000`).

So on the map — the primary surface — the entire preference model is unused, and the one surface that uses it ignores where the user is. Only the Activity Generator (surface 3) combines both, and it is reachable only from a dedicated screen.

### E7 — Candidate pool is a narrow global recency window

`getRecentThoughts` bounds candidates to `candidatePoolSize = 200` newest matching rows, then re-ranks. There is no author diversity constraint, so a prolific poster can occupy most of the pool, and no evergreen content can ever re-enter it. Both distributor calls also always execute:

```ts
Promise.all([
    interestsKeys.length ? Store.thoughts.getRecentThoughts(brand, numThoughts, interestsKeys) : Promise.resolve([]),
    Store.thoughts.getRecentThoughts(brand, numThoughts),   // always runs
]);
```

On the notifications-poll path (`recentUsersCount = 0`), the second result is used only as a one-item fallback — a full ranked query executed and discarded on every poll.

### E8 — The signal set is tiny, coarse, and strictly non-negative

Only three events feed the model, all with hardcoded weights:

| Event | Weight | Call site |
|-------|--------|-----------|
| View a moment | +2 | `maps-service/src/handlers/moments.ts:990` |
| View a space | +2 | `maps-service/src/handlers/spaces.ts:380` |
| Check in to a space | +3 | `maps-service/src/handlers/spaceMetrics.ts:193` |
| View an event | +2 | `maps-service/src/handlers/events.ts:792` |

Not captured: likes, bookmarks, shares, dwell time, replies, event RSVPs, connection overlap — despite `reactions-service` already recording most of them. And there is **no negative signal path**: no skip, hide, mute, or report ever decrements. The model's confidence is monotonically increasing in every direction, which is why E3 (no decay) compounds so quickly. A single accidental tap is indistinguishable from sustained interest, since a view fires the increment regardless of dwell.

---

## 3. Scale findings

### S1 — The distributor runs on every notifications poll

```ts
// users-service/src/handlers/notifications.ts:104-113
setImmediate(() => {
    TherrEventEmitter.runThoughtDistributorAlgorithm(req.headers, [userId], 'updatedAt', 0);
});
```

The code's own comment flags this: *"We will probably want to move this to a scheduler to run at a set interval."* Every notification fetch by every client currently costs:

1. `findUsersWithInterests` — 3-table join (`users` ⋈ `userInterests` ⋈ `interests`)
2. Two `getRecentThoughts` calls — each a 200-row candidate scan with a correlated `COUNT(*)` subquery per candidate, then a non-indexable `ORDER BY`
3. One cross-service HTTP `POST /thought-reactions/create-update/multiple` inserting/updating up to ~20 rows

Write amplification is `O(users × polls_per_session × 20)`. This is the single largest scaling liability in the system; it grows with *polling frequency*, which is unrelated to content volume or user value.

### S2 — Preference writes are per-view, cross-service, and unobservable

`incrementInterestEngagement` issues an internal REST call **per content view**, which performs a multi-row `UPDATE` joined against a subquery on `main.interests`. It is fire-and-forget with no backpressure:

```ts
}).catch((err) => {
    console.log(err);
});
```

Failures are invisible to monitoring (bare `console.log`, no `logSpan`), in-flight requests are unbounded, and the pattern means every content impression is a synchronous write to the users-service DB. Row-level lock contention on `userInterests` scales with impressions, not with users.

### S3 — Ranking work happens in Node, per request

`getTopRankedConnections` pulls every interest row for every nearby connection and builds `interestsIdMap` in application memory, then `activities.ts` re-sorts it — `O(connections × interests)` object churn on every Activity Generator invocation, with no caching of the resulting group interest vector.

### S4 — No caching or materialization anywhere in the personalization path

There is no precomputed user interest vector, no cached candidate set, and no memoization of any ranking output. Every request recomputes from base tables.

### S5 — Query-shape ceilings

- `searchRelatedSpaces` is hardcoded to `LIMIT 5` with no `offset` — the Activity Generator can never paginate, and `activities.ts` already carries the matching `// TODO: Continue pagination if group size is not satisfied`.
- The GIN indexes on `interestsKeys` are correct, but they can't be combined with the `ORDER BY createdAt DESC LIMIT 200` in the same index path — Postgres will bitmap-scan then sort. That's acceptable at current volume but degrades as any single interest's matching-row count grows.
- `searchMoments` / `searchSpaces` paginate with `LIMIT/OFFSET` over a `ST_Distance` sort, which re-sorts the full candidate set for every deep page.

---

## 4. Three optimizations

Ordered by leverage-to-effort. Each is independently shippable, and (1) → (2) → (3) is the recommended sequence: (1) makes the signal worth ranking on, (2) makes the ranking reach the user, (3) makes it affordable.

---

### Optimization 1 — Turn the preference model into a weighted, decaying vector

**Problem addressed:** E1, E2, E3, E4, E8.

**Why first:** every downstream ranking improvement is bounded by signal quality. Right now the model is effectively a boolean set membership test with a nearly-constant ranking function; no amount of ranking sophistication downstream can recover information the model never captured.

**Changes:**

1. **Add real affinity storage.** Migration on `main.userInterests` (users-service, `general` branch):
   ```js
   table.float('affinityScore').notNullable().defaultTo(0);
   table.timestamp('lastEngagedAt', { useTz: true }).nullable();
   table.integer('negativeCount').notNullable().defaultTo(0);
   table.enu('source', ['declared', 'implicit', 'both']).notNullable().defaultTo('declared');
   ```
   Keep `engagementCount` for one release as a shadow column so the new score can be validated against the old ranking before cutover.

2. **Apply decay on write, not in a batch job.** On each increment, decay the stored value to *now* before adding — no cron, no full-table sweep:
   ```
   affinityScore := affinityScore * 0.5 ^ ((now - lastEngagedAt) / HALF_LIFE) + weight
   lastEngagedAt := now
   ```
   A 45-day half-life is a reasonable starting point for a local-discovery product (seasonal interests should fade within a quarter). Expose it as config so it's tunable without a deploy.

3. **Make the increment an upsert** so behavior can discover interests the user never declared, inserting with `source = 'implicit'` and a discount factor (e.g. 0.6×) relative to declared interests. This closes E2 for SSO and onboarding-skip users and gives the "re-enable coffee?" prompt a data source.

4. **Fix `score` semantics and actually collect it.** Either invert the column to a conventional "higher is stronger" weight (with a migration that flips existing values) or — simpler and lower-risk — leave the column and have `CreateProfileInterests.tsx` send `score: 1` for a small number of user-marked "must-have" interests and `3` for ordinary selections. Add a `userInterests` validator in `therr-api-gateway` (currently absent) enforcing `1 ≤ score ≤ 5` so the `Math.min(param.score || 5, 5)` clamp bug can't be reached. **Note the split:** the validator and store changes go on `general`; the `CreateProfileInterests.tsx` change is mobile UI and can ride a niche branch, but it is useless until the backend lands — sequence `general` first.

5. **Replace `getInterestRanking` with a continuous weight** and drop `Math.ceil` entirely:
   ```ts
   const getInterestWeight = (affinityScore: number, score: number, negativeCount: number) => {
       const declaredWeight = (6 - clamp(score, 1, 5)) / 5;   // score 1 → 1.0, score 5 → 0.2
       const behavioral = Math.log1p(Math.max(affinityScore, 0));
       return declaredWeight * (1 + behavioral) / (1 + negativeCount * 0.5);
   };
   ```
   Multiplicative, not divisive: declared and behavioral signals reinforce rather than cancel.

6. **Widen and sign the signal set.** Route existing `reactions-service` events (like, bookmark, share, RSVP, reply) into the same increment endpoint with distinct weights, and add a negative path (`hide`, `report`, `not interested`) that increments `negativeCount`. Gate the view-based increment behind a minimum dwell (the client already has the timing) so a bounce doesn't count as interest.

7. **Score the overlap instead of testing it.** Replace `?| ARRAY[...]` with a weighted sum computed in SQL, passing the user's top-N weighted keys:
   ```sql
   (SELECT COALESCE(SUM(w.weight), 0)
      FROM jsonb_array_elements_text(t."interestsKeys") k
      JOIN unnest(?::text[], ?::float[]) AS w(key, weight) ON w.key = k.value)
   AS "interestScore"
   ```
   Keep the `?|` predicate as the index-using *filter* (so the GIN index still prunes) and use the sum only for *ordering*. Cap the passed key list to the user's top 8–10 weighted interests — this simultaneously restores the filter's selectivity (E4) and bounds the sum's cost.

**Expected effect:** the filter goes from ~0 selectivity to genuinely discriminating; stale interests fade; the model can learn interests the user never declared; ranking gains real resolution instead of 2–3 tied integer buckets.

**Validation:** ship with `affinityScore` computed in shadow alongside `engagementCount` for one release. Log rank correlation between old and new orderings; only cut the read path over once the distributions are understood.

---

### Optimization 2 — Persist relevance, and unify geo + interest into one shared scoring function

**Problem addressed:** E5, E6, E7, and the four-surfaces-no-shared-code problem.

**Why second:** E5 is the highest single-fix ROI in the audit — the system already computes a defensible hot score and then discards it at read time. Fixing that is a column plus an `ORDER BY`.

**Changes:**

1. **Persist the score at activation.** Add `relevanceScore float` (and `scoredAt`) to `main.thoughtReactions` in reactions-service. Have `getRecentThoughts` return its computed hot score, pass it through `createReactions`, and change `ThoughtReactionsStore.get` to `ORDER BY "relevanceScore" DESC NULLS LAST, "createdAt" DESC`. This alone converts the feed from "arbitrary within activation batch" to "actually ranked" — the ranking logic already exists and is already benchmarked.

2. **Give `ThoughtsStore.search` a deterministic order.** The current no-`ORDER BY` state (with the "sorting by updatedAt is very expensive" comment) makes pagination unsound — rows can repeat and vanish across pages. Order by `(relevanceScore, createdAt, id)` with a covering index, or switch to keyset pagination on `(createdAt, id)`; either is cheaper than the `OFFSET` scan it replaces.

3. **Extract one scoring module** into `therr-js-utilities` (isomorphic, per the repo's abstraction rules — it's a pure function over numbers and is needed by three services):
   ```
   score = w_interest  * weightedInterestOverlap
         + w_geo       * exp(-distanceMeters / GEO_SCALE)
         + w_recency   * 1 / (ageHours + 2)^1.5
         + w_social    * connectionAffinity
         + w_quality   * log1p(engagementCount)
   ```
   Weights come from config, not literals, so they're A/B-testable without a deploy. All four surfaces call it. Today the hot-score constants (`+1`, `+2`, `^1.5`) and the engagement weights (`+2`, `+2`, `+3`) are hardcoded in five different files.

4. **Close the geo/interest split (E6).** Two symmetric fixes:
   - Add an optional interest-weighted ordering to `searchMoments` / `searchSpaces` / `searchEvents`. Keep `ST_DWithin` as the index-using filter, but replace the pure `ST_Distance ASC` sort with the blended score above. Ship behind a flag defaulting to current behavior, so the map's existing distance-sorted UX is opt-in-changed rather than silently altered.
   - Add a location filter to the distributor. It currently serves globally-hot thoughts to a location-based product; bounding the candidate pool to the user's region is both a relevance win and a cost reduction.

5. **Add diversity constraints to candidate selection (E7).** Cap candidates per author and per interest within a batch (a `ROW_NUMBER() OVER (PARTITION BY "fromUserId")` filter in the inner query is sufficient), so one prolific poster can't own a user's feed.

6. **Skip the wasted query.** On the `recentUsersCount = 0` path, the general `getRecentThoughts` call runs in full and contributes at most one fallback item. Make it conditional, or request `limit 1`.

**Expected effect:** relevance actually reaches the user; the map surface becomes personalized for the first time; ranking behavior becomes tunable and testable from one place instead of five.

---

### Optimization 3 — Move personalization off the request path

**Problem addressed:** S1, S2, S3, S4 — the scale half of the brief.

**Why third:** optimizations 1 and 2 add per-request work (weighted overlap sums, blended scoring). Without this, they make S1 worse. This is what makes the first two affordable.

**Changes:**

1. **Stop running the distributor on every notifications poll (S1).** Two options, in preference order:
   - **Cache-gated trigger (smaller change, most of the win):** before running, check a Redis key `distributor:lastRun:{userId}`. Skip unless it's older than N minutes *or* the user's unviewed activated-thought count has dropped below a threshold. This turns `O(polls)` into `O(sessions)` — likely a 10–50× reduction in distributor invocations with a ~20-line change.
   - **Queue it properly:** emit a job on login and on stream-exhaustion, processed by a worker. This is where the code's own TODO points, and it's the right end state, but it needs queue infrastructure that doesn't exist yet.

   Either way, keep the `setImmediate` deferral — it's already correct for not blocking the response.

2. **Batch and debounce preference writes (S2).** Replace the per-view internal REST call with an in-process buffer flushed on an interval (or a Redis `HINCRBY` per `(userId, interestKey)` flushed by a worker). One `UPDATE ... FROM (VALUES ...)` per flush instead of one HTTP round-trip plus a subquery-joined `UPDATE` per impression. Also replace the bare `.catch(console.log)` with `logSpan` so these failures become visible — right now a fully broken preference-learning loop would produce no alert.

3. **Materialize the user interest vector (S3, S4).** A `main.userInterestVectors` table (or Redis hash) holding each user's top-N `(interestKey, weight)` pairs, refreshed on flush. The distributor and `getTopRankedConnections` then read one row instead of a 3-table join plus `O(connections × interests)` in-memory aggregation. This is also exactly the input shape Optimization 1's weighted-overlap query needs, so the two compose.

4. **Precompute candidate pools.** Cache candidate content IDs per `(brand, geohash-cell, interest)` with a short TTL, invalidated on content creation in that cell. Candidate selection becomes a cache read instead of a scan, which is what lifts the ceiling on E7's 200-row recency window — you can widen the pool without widening the per-request scan.

5. **Fix the pagination ceilings (S5).** Give `searchRelatedSpaces` a `limit`/`offset` (retiring the `// TODO: Continue pagination` in `activities.ts`), and move deep pagination on the map searches from `LIMIT/OFFSET` to keyset pagination on the sort key.

**Expected effect:** removes the growth term that scales with polling frequency rather than users or content; makes the added scoring cost from Optimizations 1–2 a cache read rather than a join.

---

## 5. Suggested sequencing

| Phase | Work | Branch | Risk |
|-------|------|--------|------|
| 1 ✅ | O2.1 persist `relevanceScore` + reorder feed; O2.2 deterministic `search` order | `general` | Low — additive column, one `ORDER BY` |
| 2 ✅ | O3.1 cache-gate the distributor; O3.2 batch preference writes + real logging | `general` | Low — behavior-preserving, immediately relieves S1/S2 |
| 3 | O1.1–O1.3 affinity column, decay-on-write, upsert (shadow mode) | `general` | Medium — validate against `engagementCount` for one release |
| 4 | O1.4 `score` collection (gateway validator + store) then mobile UI | `general`, then `niche/*` | Medium — must sequence backend first |
| 5 | O1.5–O1.7 weighted ranking + SQL overlap scoring; O2.3 shared scoring module | `general` | Medium — flag-gated, A/B on weights |
| 6 | O2.4 geo/interest unification; O2.5 diversity; O3.3–O3.5 materialization | `general` | Higher — largest UX change, do last with measurement in place |

Phases 1 and 2 are worth doing regardless of whether the rest proceeds: phase 1 makes existing ranking work visible to users for the first time, and phase 2 removes the dominant scaling liability. Both are small, low-risk, and independently valuable.

### Phases 1 and 2 — shipped

Both are implemented. What landed, and what it changes:

**Phase 1** — `main.thoughtReactions` gains `relevanceScore` / `scoredAt` plus a partial index on `(userId, relevanceScore DESC NULLS LAST, createdAt DESC) WHERE userHasActivated`. `getRecentThoughts` now returns the hot score it was already computing (the expression is hoisted into one constant so `SELECT` and `ORDER BY` cannot drift), the distributor carries per-thought scores through `createReactions` onto the reaction rows with a 1.5× boost for interest matches, and `searchActiveThoughts` orders by relevance and restores that order after the thoughts lookup re-sorts by `createdAt`. `ThoughtsStore.search` gained the `ORDER BY` it never had.

Two consequences to watch on rollout:

- Pre-existing reaction rows have a NULL score and sort last, so existing users see a **one-time feed reshuffle** on first load after deploy — in the intended direction, but visible.
- `lastContentCreatedAt` is no longer forwarded on the feed path (it is a `createdAt` cursor, wrong axis for a relevance-ordered page, and would silently drop high-scoring recent thoughts). The author-profile path still uses it. Offset pagination over a relevance-ordered list can still repeat an item when a new activation lands mid-scroll; that was already true of the createdAt ordering and is properly fixed only by keyset pagination.

**Phase 2** — the distributor is gated to one run per user per window (`THOUGHT_DISTRIBUTOR_MIN_INTERVAL_SECONDS`, default 900s) via an atomic `SET NX EX` on the existing ephemeral Redis client. Login stays ungated so a new session always seeds the stream. The gate **fails open**: if Redis is unreachable the distributor runs, exactly as before. The general-candidate query now requests 1 row instead of a full page when only a fallback is needed.

Redis footprint is intentionally negligible: one key per *recently active* user holding the literal `'1'`, ~90 bytes with overhead, self-expiring. 100k users active inside one window is under 10 MB, and idle users hold nothing. It is not a cache that needs to stay warm — losing the entire keyspace only means each user's next poll runs the distributor once more than it strictly needed to.

Interest engagement writes are coalesced per user in an **in-process** buffer (`INTEREST_ENGAGEMENT_FLUSH_INTERVAL_MS`, default 10s) and flushed as one request with merged counts, so a user scrolling twenty moments produces one write instead of twenty. This deliberately uses no Redis at all — engagement counts are best-effort telemetry and a per-replica buffer costs no shared infrastructure. The trade-off is that increments buffered when a pod is hard-killed are lost; a SIGTERM flush covers graceful shutdown. The `.catch(console.log)` that made a broken preference loop invisible is now a `logSpan` error.

The users-service increment endpoint accepts both the new coalesced (`interestIncrements`) and legacy (`interestDisplayNameKeys` + `incrBy`) payloads, and senders emit both, so a rolling deploy in either order keeps recording.

Still open from Optimization 3 and explicitly **not** done: materialized user interest vectors and precomputed candidate pools (O3.3, O3.4). Those are the Redis-memory-heavy parts.

## 6. Instrumentation to add before phase 6

None of the above can be evaluated today — there is no logging of what was served, why, or whether it was engaged with. Before changing ranking weights, add:

- Impression logging with the score components that produced each ranking (needed to attribute any metric change to a specific term).
- Per-surface CTR and dwell, split by whether the item matched a declared vs. implicit interest.
- Distributor invocation count and activated-thought consumption rate (validates O3.1's cache-gate threshold).
- Shadow-mode rank correlation between old and new scoring during phases 3 and 5.
