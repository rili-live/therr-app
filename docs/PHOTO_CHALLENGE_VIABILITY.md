# Photo Challenge — Viability Assessment

**Status:** Assessment only — nothing built, no schema, no endpoints
**Date:** August 2026

## Context

The proposal: a **host** — a business, event organizer, or landmark owner — creates a
geo-anchored *photo challenge*. Entrants submit a photograph captured **through the app's
camera only**, with library upload disabled, so the image is authentic, recent, and taken
at the location. Any user worldwide swipes left/right to vote. The host has final say on
the winner. The host pays a cash reward and Therr takes a processing fee.

The pitch to a business is concrete and good: most small businesses have no usable
photography, and stock imagery is visibly stock. This sources real local imagery, with
rights, from someone who was actually there. It is a gig economy for local photography
layered onto a location graph Therr already has.

This document answers **should we build it**, not how. The conclusion is a qualified yes
with a specific sequencing, and the reasoning matters more than the verdict — a first read
of this feature misjudges which parts are hard.

**Assumptions fixed before this assessment** (they narrow it considerably):

- **Prize rail:** off-platform. The host pays Therr a listing fee through the existing
  Stripe Checkout path and pays the winning photographer directly. Therr never holds or
  transmits prize money.
- **Placement:** core Therr brand, not a new niche variant.

## Verdict

**Conditional yes — staged, non-cash first.**

Three findings drive that:

1. The **capture-and-geo half is largely existing infrastructure**. Camera capture, signed
   uploads, CDN delivery, PostGIS geo, proximity gating, NSFW screening, and a
   host-owns-a-place model are all in production. This is assembly, not invention.
2. The **money half is cheap** *because of the chosen rail*. Charging a host reuses
   `createCheckoutSession` nearly unchanged. Paying photographers on-platform would have
   been a regulated-payments buildout; the off-platform rail sidesteps it entirely.
3. The **binding constraint is neither** — it is two-sided liquidity at current scale, and
   it is the thing most likely to kill this.

The recommendation is therefore to build the cheap, reversible parts first and let
liquidity evidence decide whether the rest happens. § Phased Path gives the sequence and
§ Kill Criteria gives the evidence that should stop it.

---

## Current State (Baseline)

Everything below already exists and would be reused rather than written.

| Capability | Location | Status |
|---|---|---|
| Camera vs. library capture | `TherrMobile/main/routes/EditMoment/index.tsx:610` + 5 sibling flows (`EditSpace`, `EditEvent`, `EditGroup`, `EditThought`, `Map`) | Active — already branches `ImageCropPicker.openCamera()` / `.openPicker()` |
| Signed-URL upload (write) | `maps-service/src/handlers/moments.ts:1272`, `spaces.ts:988`, `events.ts:1077`; client via `therr-react/src/services/MapsService.ts:422` and `TherrMobile/main/utilities/content.ts` (`signImageUrl`) | Active |
| Media read + CDN | `maps-service/src/handlers/createMediaUrls.ts`; `main.media` table (`20210505070730_main.media.js`) | Active — ImageKit public, v4 signed URLs private |
| NSFW screening | `checkIsMediaSafeForWork` — `maps-service/src/handlers/helpers/index.ts:103`; called from `moments.ts:319,515`, `spaces.ts:146,771`, `events.ts:441`, and `users-service/src/handlers/users.ts:799` | Active — Sightengine, live in production |
| Geo + proximity gating | PostGIS installed (`20201114133957_main.moments.js`); `latitude`/`longitude` doubles, `maxProximity`, `doesRequireProximityToView` columns | Active |
| Host-owns-a-place | `main.spaces` / `main.events` (`fromUserId`, `spaceId`); business claim funnel in `GROWTH_STRATEGY.md` | Active |
| Voting substrate | `reactions-service` — `main.momentReactions`, `spaceReactions`, `eventReactions`, `thoughtReactions` | Active |
| Charging the host | `users-service/src/api/stripe.ts`, `handlers/payments.ts:67` (`createCheckoutSession`), `helpers/checkoutSessionPlans.ts` | Active — already takes real money |
| Proof-media schema precedent | `habits.proofs` — `users-service/src/store/migrations/20260126000008_habits.proofs.js`; `ProofsStore.ts`; written at `habitCheckins.ts:134` | Partial — see below |

### `habits.proofs` is the design template

The closest existing analogue is not moments — it is habit check-in proof media. It solves
the same problem this feature depends on: *prove this image is real, recent, and taken
where it claims*. The schema already carries the exact columns:

```js
table.timestamp('capturedAt', { useTz: true }); // From EXIF
table.jsonb('location');                        // Optional GPS from EXIF { lat, lng }
table.string('verificationStatus', 20)...       // pending, auto_verified, verified, rejected, flagged
table.jsonb('moderationFlags');                 // Sightengine response
```

A photo challenge entry is the same row shape with a `challengeId` instead of a
`checkinId`.

**Important caveat:** the table, `ProofsStore.ts`, and the write path at
`habitCheckins.ts:134` all exist, but **no mobile capture UI populates `capturedAt` or
`location`**. Those columns are designed and unexercised. Treat this as a validated design,
not as working verification code.

---

## The Real Gaps

Ranked by how much they hurt, not by size.

### 1. EXIF is destroyed before it reaches the server

Every picker call site sets `cropping: true` — for example
`TherrMobile/main/routes/EditMoment/index.tsx:600-607`:

```js
const pickerOptions: any = {
    mediaType: 'photo',
    includeBase64: false,
    height: 4 * viewportWidth,
    width: 4 * viewportWidth,
    multiple: false,
    cropping: true,
};
```

Cropping re-encodes the image, and `react-native-image-crop-picker` does not return EXIF
unless asked. `includeExif` appears **nowhere in the repository** — the grep returns zero
hits across `TherrMobile` and `therr-client-web`.

So the capture timestamp and GPS coordinates that the entire authenticity premise rests on
are stripped at the source, before any server ever sees them. This is a small fix and a
load-bearing one. Nothing in the current product would have surfaced it, because
`habits.proofs` — the only consumer of those fields — has no capture UI yet.

### 2. `openCamera()` is a UX affordance, not an attestation

Restricting to `openCamera()` is close to free: it is one branch of an `if` that already
exists in six flows. But it should not be mistaken for proof. It stops a casual user from
picking a stock photo off their camera roll. It does not stop a modified client, a rooted
or jailbroken device, or a virtual-camera app that presents a file as a live capture
feed — and a cash prize is exactly the incentive that summons those.

Genuine assurance has to be server-side and layered:

- EXIF `capturedAt` falls inside the challenge window
- EXIF GPS falls inside the challenge geofence
- Device-reported location at submit time agrees with both
- Server-side receipt timestamp bounds how stale a submission can be
- Perceptual hashing against prior entries and against the host's own existing imagery, to
  catch resubmission and scraped photos

Each check is individually weak and collectively decent. None of them is a guarantee, and
the honest framing is **defense-in-depth with residual risk that the host's final say is
the real backstop for**. Publish the checks as "verified signals" on each entry rather than
as a binary authentic/not badge, so the host can weigh them and Therr is not asserting
something it cannot prove.

### 3. No swipe-deck UI exists

`react-native-gesture-handler` (2.30) and `react-native-reanimated` (4.3) are both in
`TherrMobile/package.json`, which makes this look solved. It is not. Grep across
`TherrMobile/main` finds **zero** usages of `Gesture.Pan`, `PanGestureHandler`,
`PanResponder`, `Swipeable`, or `PagerView`. The libraries are present as navigation
dependencies. The existing "swipeable" carousels are scroll-based.

The Tinder-style card deck — drag physics, rotation, snap-back, undo, prefetching the next
images, accessibility fallbacks for users who cannot drag — is genuine greenfield work and
the single largest client-side line item. Budget it as such rather than as "we already have
gesture-handler."

### 4. Moderation's race window, on the worst possible surface

`checkIsMediaSafeForWork` is real and live, which is better than the backlog implies. But
it is invoked **fire-and-forget after the row is already inserted**. The code says so
directly at `maps-service/src/handlers/moments.ts:313`:

```
// TODO: This technically leaves room for a gap of time where users may find
// explicit content before it's flag has been updated. We should solve this by
// marking the content pending before making it available to search.
```

`WORK_IN_PROGRESS.md` §4.1 calls this class of gap the single biggest App Store rejection
risk on the platform.

A prize-bearing contest open to worldwide submission is the worst surface to inherit that
race on, because it *actively recruits uploads from strangers who have a financial motive
to be seen*. Every other surface with this gap is fed by users posting about their own
lives.

The fix §4.1 already prescribes — mark pending, withhold from the feed until the check
returns — is **cheaper here than anywhere else**, because a challenge entry has a natural
"pending review" state that a moment does not. Entries are not expected to appear
instantly; they are expected to appear in a voting queue. Build it correctly here and it
becomes the reference implementation for retrofitting the other five call sites.

---

## Why the Off-Platform Prize Rail Is Right

The avoided cost is concrete. Grep of `users-service/src/api/stripe.ts` and
`handlers/payments.ts` finds only `checkout.sessions`, `webhooks`, `billingPortal`, and
`customers`. There is **no `accounts.create`, no `transfers`, no `payouts`** anywhere in
the repository.

Paying photographers on-platform would require, at minimum:

- Stripe Connect Express onboarding with per-recipient identity verification (KYC)
- Escrow of host funds between challenge creation and winner selection
- Refund, dispute, and negative-balance handling when a challenge is cancelled or contested
- Year-end 1099-NEC / 1099-K reporting, and the tax-data collection that implies
- A posture on money transmission that currently does not exist anywhere in the product

This is not a sprint. It is a compliance surface with ongoing operational cost.

The house pattern confirms the instinct to avoid it. Cash-out today is
`requestRewardsExchange` at `users-service/src/handlers/rewards.ts:41` — it sends an
**email to an admin** who fulfills by hand. `docs/PLAID_REWARDS_IMPLEMENTATION.md` states
this is deliberate: *"There is zero automation, which is intentional while the startup
protects itself from abuse and unexpected volume."* An automated worldwide payout rail
would contradict a stance the company has already reasoned through.

**The tradeoffs of going off-platform, stated plainly:**

- A host can simply not pay the winner. Therr's only lever is reputational.
- Mitigations: withhold the full-resolution deliverable and the licence grant until the
  host confirms payment; publish a host payment-reliability rating; suspend hosts with
  unresolved complaints.
- This makes Therr a marketplace with a weaker guarantee than a Connect-based one. That is
  the correct trade at this stage, but it should be disclosed to entrants in plain language
  at submission time, not buried in terms.

### Contest law — survives any rail choice

**Entrants must pay nothing.** No entry fee means no *consideration*, which is one of the
three elements (prize, chance, consideration) that define a lottery in US states. Removing
it keeps this a prize contest rather than a regulated lottery.

Combined with the host having final say — which makes the outcome **sponsor-judged on
skill**, with the swipe vote formally advisory — this is the structurally safest shape
available, and it is the shape already proposed. Worth recognizing that the "host has final
say" decision, which reads like a product nicety, is also what keeps this out of
chance-based territory.

Two things still needed before any real money is offered: written official rules per
challenge (sponsor identity, eligibility, judging criteria, dates, odds language, void
where prohibited), and counsel review of those rules and of the licence transfer from
photographer to host. **This document is not legal advice and should not substitute for
that review.**

---

## The Binding Constraint: Liquidity

This is the section most likely to change the decision, so it is not buried at the end.

`docs/WORK_IN_PROGRESS.md:1010` states the platform handles **~50 users today**.

A photo challenge is a two-sided marketplace. It needs *photographers physically near one
specific location* and *enough voters to make a swipe feed feel alive*. Both sides fail
independently, and the location constraint is brutal: a national user count does not help a
challenge at one coffee shop in one neighborhood.

At current density, the realistic outcome for a host-created challenge is **zero
submissions**. That is not a soft failure. A business that paid a listing fee and received
nothing is a refund, a support burden, and a permanently lost B2B relationship — with
exactly the businesses `GROWTH_STRATEGY.md` is spending its outreach budget acquiring. The
downside is worse than not shipping.

### The strategic tension, named

`GROWTH_STRATEGY.md` is explicitly B2B-directory-first *because* consumer density is
unachievable for a solo developer without marketing budget, and its 90-day milestone is
**one business paying $14.99/month**.

This feature is a consumer-density bet wearing a B2B costume. Its revenue story is B2B, but
its delivery depends entirely on consumer supply that the current strategy has concluded
cannot be manufactured.

That does not make it wrong. It monetizes the same claimed-space relationship the funnel
already builds, and it gives the outreach email a far stronger hook than "claim your
listing." But it should be chosen deliberately as a second bet alongside Habits, not
slipped in as a natural extension of the directory. **The organization has finite capacity
for consumer-density bets, and Habits is already the active one.**

### De-risked sequencing

- Pilot in **one** city that already has enriched space data and a real user cluster —
  Chicago is the furthest along per `GROWTH_STRATEGY.md`.
- **Therr hosts the first challenges itself.** Do not put a paying customer in front of an
  unproven supply side.
- Gate fee capture on a **minimum submission count**. If the floor is not met, the
  challenge voids and the host is not charged. This converts the worst-case business
  outcome from "paid and got nothing" to "nothing happened."
- Recruit supply deliberately: local photography groups, students, hobbyists. Treat the
  first ten challenges as manual operations, not as a product.

---

## Phased Path

Each phase carries independent value and gates the next, mirroring the structure
`PLAID_REWARDS_IMPLEMENTATION.md` uses.

| Phase | Scope | Money | Rough effort |
|---|---|---|---|
| **0 — Prerequisites** | `includeExif: true` + persist `capturedAt`/GPS; make the Sightengine check blocking for pending entries | None | Days |
| **1 — Prove supply** | Therr-hosted challenges, TherrCoin/XP prize, swipe deck, host selection UI, entry schema | None | Weeks |
| **2 — Money in** | Host-created challenges, Stripe Checkout listing fee, off-platform prize, deliverable withheld until payment confirmed | In only | Weeks |
| **3 — Money out** | Stripe Connect Express, escrow, KYC, 1099s | In + out | **Deferred** |

**Phase 0** is worth doing largely regardless of this feature. Both items improve existing
surfaces — EXIF unblocks the dormant `habits.proofs` columns, and blocking moderation
addresses the platform's highest-rated App Store risk. Neither commits to the feature.

**Phase 1** is the real experiment. It answers the only question that matters — *do
entrants show up at a specific place?* — for the cost of the swipe deck and a schema, with
no payment surface and no host to disappoint.

**Phase 2** adds revenue once supply is proven, reusing `createCheckoutSession`.

**Phase 3 is explicitly deferred and this document does not recommend it.** It should
require a fresh decision against real Phase 2 volume, not inherit approval from this
assessment.

### Kill criteria

Stop, do not proceed to the next phase, if:

- **After Phase 1:** median submissions per challenge is below ~5 in the pilot city after
  ten Therr-hosted challenges. Below that, no host will pay and the vote feed is empty.
- **After Phase 1:** voting participation is concentrated in a handful of users, making
  results trivially brigadable and the swipe feed a vanity surface.
- **After Phase 2:** hosts do not repeat. A photo challenge is only a business if it
  recurs; one-shot purchases will not cover the build.
- **At any point:** verification signals prove unreliable enough that hosts dispute
  authenticity. The value proposition is authentic local imagery — if that erodes, the
  feature is just a worse Instagram.

---

## Where the Code Would Land

No code ships with this assessment. For future reference:

Per `CLAUDE.md`, backend services, shared libraries, and migrations **must land on
`general`** — it is the only branch with a CI path to production. Since placement is the
core Therr brand rather than a niche variant, effectively all of this feature belongs on
`general`, including the mobile screens.

A `main.photoChallenges` table (and its entries/votes) would be **identity-shared, not
brand-scoped**. This matches the reclassification already recorded in
`eslint-config/brand-scoped-tables.js`, where `main.moments`, `spaces`, `events`, and the
`*Reactions` tables were moved out of the brand-scoped set after an audit confirmed the
niche apps do not read or write them. A photo challenge is the same kind of object.

Voting rows should extend the `reactions-service` pattern rather than inventing a parallel
one — a swipe is a reaction with a binary value.

---

## Summary

| Dimension | Assessment |
|---|---|
| Technical feasibility | **High** — most of the media/geo pipeline exists |
| Payment complexity (chosen rail) | **Low** — reuses existing Stripe Checkout |
| Payment complexity (on-platform payouts) | **High** — deferred to Phase 3, not recommended now |
| Legal exposure | **Manageable** — no entry fee, sponsor-judged; needs official rules + counsel |
| Content-safety risk | **Elevated** — inherits a known race window on the worst surface for it; fix in Phase 0 |
| Market risk | **High** — two-sided liquidity at ~50 users is the real constraint |
| Strategic fit | **Mixed** — strong B2B revenue story, but a second consumer-density bet alongside Habits |

The feature is buildable and the concept is sound. Build Phase 0 because it pays for itself
elsewhere, run Phase 1 as a genuine experiment with pre-committed kill criteria, and let
the submission numbers — not this document — decide whether Phase 2 happens.
