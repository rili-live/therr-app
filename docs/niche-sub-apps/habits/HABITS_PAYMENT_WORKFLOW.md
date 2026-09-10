# HABITS — Payment Workflow

**Status:** Backend shipped (founder lifetime unlock via Google Play Billing)
**Owner:** Solo founder
**Last Updated:** 2026-08-15

> **What changed.** This document previously described a Stripe web-checkout
> flow — mobile opens `habits.therr.com` in the system browser, user pays,
> deeplink back. That plan was replaced before implementation. The reasoning is
> in § Why Play Billing. The free-tier gate also changed: it caps **active
> habits**, not pacts created.

---

## The offer

| | |
|---|---|
| Product | "Free for life" — one payment, premium forever |
| Price | $20 USD, one time |
| Availability | The first **5,000** accounts (`HABITS_LIFETIME_FOUNDER_LIMIT`) |
| Rail | Google Play Billing, one-time non-consumable |
| Play product id | `habits_lifetime_founder` (`HABITS_LIFETIME_PRODUCT_ID`) |
| Free tier | 5 active habits (`HABITS_FREE_HABIT_LIMIT`) |

Accounts that buy it get `AccessLevels.HABITS_LIFETIME`, which lifts the habit
cap and every future `PREMIUM_*` gate.

---

## Why Play Billing, not Stripe web checkout

The earlier plan sold the subscription on the web to avoid Google's 15% cut. It
was legally defensible, but it carried two costs that the founder offer cannot
absorb:

1. **Policy risk on the release we are trying to promote.** Selling in-app
   digital content outside Play Billing is the kind of thing that gets a
   production submission rejected, and Friends with Habits is *already* carrying
   one User Data policy rejection (`docs/WORK_IN_PROGRESS.md`). Stacking a
   second, avoidable policy question on the same submission is a bad trade for
   15% of a $20 sale.
2. **It requires hiding the offer.** The external-purchase pattern only works if
   the app does not advertise, link to, or imply that an external purchase
   exists — the URL is supposed to be fetched at runtime so the literal string
   is not in the binary. That is a workable arrangement for a renewal link. It
   is a terrible one for a headline, limited-availability founder offer whose
   entire job is to be seen.

The 15% is real. It is the cheaper of the two costs.

---

## Architecture

```
Mobile                     users-service                    Google Play
──────                     ─────────────                    ───────────
requestPurchase()  ────────────────────────────────────────▶  charges the user
   │                                                              │
   │◀───────────────────── purchaseToken ─────────────────────────┘
   │
   └── POST /habits/lifetime/verify ──▶ 1. purchases.products.get ──▶ verify
                                        2. record + allocate founder slot
                                        3. grant HABITS_LIFETIME
                                        4. purchases.products:acknowledge ──▶
                                    ◀── { purchase, accessLevels }
```

Nothing the client says about a purchase is trusted. It sends a token; the
server asks Play what that token actually is.

### Endpoints

| Route | Purpose |
|---|---|
| `GET /users-service/habits/lifetime` | Seats remaining, sold-out flag, this account's purchase and entitlement, and whether the server has Play credentials at all |
| `POST /users-service/habits/lifetime/verify` | Verify a completed purchase, record it, grant the entitlement, acknowledge with Play |

### Code

| Concern | File |
|---|---|
| Play Developer API client | `therr-services/users-service/src/api/googlePlay.ts` |
| Handler | `therr-services/users-service/src/handlers/habitsLifetime.ts` |
| Purchase ledger + founder slots | `therr-services/users-service/src/store/LifetimePurchasesStore.ts` |
| Table | `20260815000002_habits.lifetime_purchases.js` |
| Entitlement check (single source of truth) | `therr-js-utilities/src/constants/habitsEntitlements.ts` → `hasHabitsPremiumEntitlement` |
| Client service | `therr-react/src/services/HabitsLifetimeService.ts` |

### Ordering, and why it is not interchangeable

1. **Verify with Play** — never trust the client's claim.
2. **Record the purchase** — allocates the founder slot inside a transaction
   holding `pg_advisory_xact_lock`, so two simultaneous buyers cannot claim the
   same number. A `UNIQUE (purchaseToken)` index makes a replayed token fail
   loudly rather than granting twice.
3. **Grant `HABITS_LIFETIME`** — merged into `accessLevels`, never assigned
   over it. The user record is read with `accessLevels` explicitly selected; a
   partial select makes the merge see `undefined` and wipe `EMAIL_VERIFIED`,
   which locks the buyer out of login. See `WORK_IN_PROGRESS.md` § 1.5.
4. **Acknowledge with Play** — last. Play auto-refunds anything unacknowledged
   after three days, so a failure here is worth alerting on, but it leaves an
   entitled user and a retryable acknowledgement. Acknowledging first would risk
   the reverse: a consumed purchase we never honoured.

### Selling past 5,000

A purchase that completes after the last slot is **still honoured**, with a null
founder number and a warn span. They paid; refusing to record a completed Play
transaction would leave them charged and unentitled. The client hides the CTA
once `remaining <= 0`, so this is the narrow render-to-purchase race, not a
routine path.

Refunds do **not** return a slot. The offer is a fixed number of seats, and
reclaiming them would let a refund-repurchase loop churn the counter.

---

## The free-tier gate

`assertHabitCapacity` (`handlers/helpers/habitCapacity.ts`) is the only place
the rule lives. It is enforced at four entry points:

- `POST /habits/pacts` — create a pact
- `POST /habits/pacts/bulk-invite`
- `PUT /habits/pacts/:id/accept` — and therefore the claim path
- `POST /habits/user-habits` and `PUT /habits/user-habits/:id/restore`

All return **HTTP 402** with `{ error: 'habit-limit-reached', limit,
activeHabitCount, upgradeRequired: true }`.

**Why habits and not pacts.** The old cap counted pacts the user created, which
punished exactly the behaviour the app exists to encourage — a user with one
habit and four accountability partners was at the limit, while a user with five
solo habits and no friends was not.

**Accepting an invite is capped too.** A friend's invitation can hit the
paywall. That is deliberate: an uncapped accept path makes the limit meaningless
for anyone with friends. The escape hatch is free — archiving a habit keeps all
its check-ins, streaks and journal entries — and the client offers it inline
next to the upgrade.

**It fails open.** A database error lets the request through. The cap is a
commercial limit with no integrity stake; the worst case is one extra free
habit.

---

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `GOOGLE_PLAY_PACKAGE_NAME` | — | `com.therr.habits` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | — | Raw JSON or base64. Needs Play Console access with "View financial data, orders, and cancellation survey responses" |
| `HABITS_LIFETIME_PRODUCT_ID` | `habits_lifetime_founder` | |
| `HABITS_LIFETIME_FOUNDER_LIMIT` | `5000` | |
| `HABITS_FREE_HABIT_LIMIT` | `5` | |

With no credentials configured the endpoints return 503 and the client hides the
CTA (`isStoreConfigured: false`) rather than showing a button that cannot work.

---

## Still to do

- **Play Console setup.** Create the `habits_lifetime_founder` product, create
  the service account, add license testers. IAP does not function until the app
  is published on a track.
- **Data Safety form.** `HABITS_PLAY_LISTING.md` currently declares Financial
  info "No" and Purchase history "No" on the grounds that there is no payment
  path. Adding IAP changes that answer.
- **Refund / revocation handling.** `habits.lifetime_purchases.status` and
  `LifetimePurchasesStore.setStatus` support it, but nothing consumes Play's
  Real-Time Developer Notifications yet, so a refunded buyer keeps the
  entitlement. Needs a Pub/Sub subscriber.
- **iOS.** The `platform` column and the client's `platform` field are in place;
  StoreKit verification is not.

---

## Testing

- **Unit:** `tests/unit/handlers-habits-lifetime.test.ts` (verification,
  replay, sold-out, access-level merge), `tests/unit/habitCapacity.test.ts`
  (exemptions, fail-open).
- **On device:** requires a license tester and a build on a Play track.
  `purchaseType: 1` in the Play response marks a test purchase.
- **Gate:** create habits up to `HABITS_FREE_HABIT_LIMIT`; the next request
  returns 402. Archive one and it succeeds.
- **Replay:** submit the same `purchaseToken` from a second account — expect
  409 `purchase-already-claimed`.

---

## References

- `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` § Phase 4
- `therr-js-utilities/src/constants/enums/AccessLevels.ts` — `HABITS_LIFETIME`
- `therr-js-utilities/src/constants/enums/FeatureFlags.ts` — the limits
- Play Billing one-time products:
  https://developer.android.com/google/play/billing/integrate
