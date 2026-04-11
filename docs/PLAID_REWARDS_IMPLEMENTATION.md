# Plaid Rewards Implementation Plan

## Context

The long-term vision is to reward consumers with cash back when they spend at Therr-enrolled
businesses, verified by real bank transaction data via Plaid. Today the rewards system is entirely
manual: a consumer requests a coin-to-gift-card exchange, an admin email fires, and someone
manually fulfills the request. There is zero automation, which is intentional while the startup
protects itself from abuse and unexpected volume.

This plan introduces Plaid in four phases — each providing independent value and de-risking the
next phase before automation increases.

---

## Current State (Baseline)

| Component | Location | Status |
|---|---|---|
| Coin exchange (manual) | `therr-services/users-service/src/handlers/rewards.ts` | Active |
| Coin transfer (atomic) | `therr-services/users-service/src/store/UsersStore.ts` (line 554) | Active |
| Gift card UI (mobile) | `TherrMobile/main/routes/Rewards/ExchangePointsDisclaimer.tsx` | Active |
| Stripe subscriptions | `therr-services/users-service/src/handlers/payments.ts` | Active |
| `MAKE_A_PURCHASE` incentive key | `therr-public-library/therr-js-utilities/src/constants/enums/IncentiveRequirementKeys.ts` | Defined, unused |
| `spaceIncentives` table | `therr-services/maps-service/src/store/migrations/20230206135133_main.spaceIncentives.js` | Active |
| Plaid | — | **Not implemented** |

**Key gap**: The `spaces` table has `businessTransactionId`/`businessTransactionName` but no Plaid
merchant identifier. The `users` table has no Plaid access token field.

---

## Architecture Decision: Stripe vs Plaid

**Keep them completely separate.** They solve different problems:

- **Stripe** = B2B subscription revenue (dashboard subscriptions). No changes needed.
- **Plaid** = Consumer transaction verification + business bank enrollment + eventual payouts.

No cross-integration is needed. Stripe product ID → access level mapping is untouched.

---

## Merchant Matching Challenge

When a consumer buys at "Joe's Pizza" (a Therr space), their Plaid transaction reads something like
`"JOES PIZZA ARLINGTON VA 12345"`. How do we match that to the right `spaceId`?

| Approach | Reliability | Complexity | Verdict |
|---|---|---|---|
| Fuzzy name match only | Low | Medium | Too many false positives |
| Geo-proximity + fuzzy name | Medium | Medium | Better, still ambiguous for chains |
| Business owner stores Plaid-normalized name at enrollment | High | Low | **Chosen** |
| ACH routing number matching | High | High | Only works if POS routes to same bank |
| Admin manual review for all | 100% | High (ops) | Phase 2 safety net |

**Chosen approach**: During business enrollment (Phase 1), capture Plaid's `merchant_name`
(enriched/normalized from the institution's identity data) and store it on the space record.
Consumer transactions are matched by comparing the Plaid transaction `merchant_name` against the
stored value, boosted by haversine distance to the space's lat/lng. Low-confidence matches go to
an admin review queue.

---

## Phase 1: Foundation & Business Merchant Enrollment

**Goal**: Safe schema + UI for business owners to connect their bank. No consumer exposure, no
automation, no coins disbursed.

### Database Migrations

**`therr-services/maps-service/src/store/migrations/<timestamp>_spaces.plaid.js`**
```
spaces table additions:
  plaidItemId          VARCHAR(255) NULL
  plaidMerchantName    VARCHAR(255) NULL   -- Plaid-normalized, stored at enrollment
  plaidInstitutionId   VARCHAR(100) NULL
  plaidEnrolledAt      TIMESTAMP WITH TZ NULL
```

**`therr-services/users-service/src/store/migrations/<timestamp>_main.plaidItems.js`**

New table `main.plaidItems`:
```
  id                   UUID PRIMARY KEY
  userId               UUID NOT NULL FK → users
  spaceId              UUID NULL FK → spaces   (null = consumer account)
  itemId               VARCHAR(255) NOT NULL   -- Plaid item_id
  accessToken          TEXT NOT NULL           -- AES-256-GCM encrypted
  institutionId        VARCHAR(100)
  institutionName      VARCHAR(255)
  enrollmentType       VARCHAR(20)             -- 'business' | 'consumer'
  status               VARCHAR(20)             -- 'active' | 'error' | 'revoked'
  createdAt            TIMESTAMP WITH TZ DEFAULT NOW()
  updatedAt            TIMESTAMP WITH TZ DEFAULT NOW()
```

### New Backend Files

**`therr-services/users-service/src/api/plaid.ts`**
- Plaid Node SDK wrapper (`plaid` npm package)
- `createLinkToken(userId, clientName, products[])` → returns `link_token`
- `exchangePublicToken(publicToken)` → returns `{ access_token, item_id }`
- `getIdentity(accessToken)` → institution + account owner name
- Token encryption/decryption helpers using `AES-256-GCM`

**`therr-services/users-service/src/handlers/plaid.ts`**
- `createBusinessLinkToken(req, res)` — generates link token for dashboard Plaid Link
- `enrollBusiness(req, res)` — exchanges public token, fetches identity, saves encrypted token
  and merchant name on the associated space
- `revokePlaidItem(req, res)` — invalidates access token, clears space fields

**`therr-services/users-service/src/routes/plaidRouter.ts`**
```
POST   /plaid/link-token           createBusinessLinkToken  (auth required)
POST   /plaid/business/enroll      enrollBusiness           (auth + space ownership)
DELETE /plaid/business/:spaceId    revokePlaidItem          (auth + space ownership)
```

**`therr-api-gateway/src/services/users/router.ts`** — add Plaid routes with a dedicated
`plaidEnrollmentLimiter` (5 req/hr per user).

### Security Requirements (Phase 1)

- Access tokens encrypted before DB write:
  `crypto.createCipheriv('aes-256-gcm', PLAID_TOKEN_ENCRYPTION_KEY, iv)`
- Encryption key from env var `PLAID_TOKEN_ENCRYPTION_KEY` (32 bytes, never in code)
- Plaid API keys: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` → `development` → `production`)
- Tokens never returned to frontend — backend only
- Space ownership validated before enrollment (403 if requester is not space owner)

### Dashboard UI (Business)

**`therr-client-web-dashboard/src/`** — New "Cash Back Program" section in space management:
- Plaid Link button ("Connect your business bank account")
- Enrollment status indicator (connected / not connected)
- Disconnect option with confirmation dialog
- Plaid-normalized merchant name preview (read-only)

### Phase 1 Gate
- 10+ businesses enrolled
- Admin can verify merchant name data quality matches space names
- No consumer-facing changes, zero coin disbursement risk

---

## Phase 2: Consumer Opt-in & Manual Review Queue

**Goal**: Consumers can optionally link banks. Transactions captured and manually reviewed before
any coins are awarded.

### Database Migrations

**`therr-services/users-service/src/store/migrations/<timestamp>_main.plaidTransactionMatches.js`**

New table `main.plaidTransactionMatches`:
```
  id                   UUID PRIMARY KEY
  userId               UUID NOT NULL FK → users
  spaceId              UUID NOT NULL FK → spaces
  plaidTransactionId   VARCHAR(255) UNIQUE NOT NULL  -- prevents replay attacks
  amount               DECIMAL(10, 2) NOT NULL
  merchantName         VARCHAR(255)                  -- from Plaid transaction
  confidenceScore      DECIMAL(4, 3)                 -- 0.000–1.000
  status               VARCHAR(20)                   -- 'pending'|'approved'|'rejected'|'awarded'
  coinsAwarded         DECIMAL(12, 2) NULL
  reviewedBy           UUID NULL FK → users
  reviewedAt           TIMESTAMP NULL
  transactionDate      DATE
  createdAt            TIMESTAMP WITH TZ DEFAULT NOW()
  updatedAt            TIMESTAMP WITH TZ DEFAULT NOW()
```

### New Backend: Webhook Receiver

**`therr-services/users-service/src/handlers/plaidWebhooks.ts`**
- Validate Plaid webhook signature (`Plaid-Verification` header)
- Handle `TRANSACTIONS` → `DEFAULT_UPDATE` / `SYNC_UPDATES_AVAILABLE`
- Fetch new transactions via `transactionsSync`
- Run matching algorithm → write potential matches with confidence score
- Never award coins — only record potential matches in Phase 2

**`therr-services/users-service/src/utilities/plaidMatching.ts`** — Matching algorithm:
1. Extract transaction `merchant_name` and `location` (lat/lng if present)
2. Query enrolled spaces where `plaidMerchantName IS NOT NULL`
3. Compute Jaro-Winkler similarity between transaction `merchant_name` and stored `plaidMerchantName`
4. Boost score if transaction lat/lng falls within the space's `radius`
5. Write `plaidTransactionMatches` row only if score ≥ 0.85 (below = discard)

**Route additions:**
```
POST   /plaid/webhook              plaidWebhookReceiver     (no auth, signature validation)
POST   /plaid/consumer/enroll      consumerEnroll           (auth required)
DELETE /plaid/consumer             consumerRevoke           (auth required)
GET    /plaid/consumer/status      consumerStatus           (auth required)
```

### Admin Review Queue

**`therr-client-web-dashboard/src/`** — New "Pending Rewards" admin page:
- Table of `plaidTransactionMatches` with `status = 'pending'`
- Columns: consumer, matched space, transaction amount, confidence score, transaction date
- Approve → award coins via existing `transferCoins` logic
- Reject → record decision, no coins moved

### Mobile Consumer UI

**`TherrMobile/main/routes/Rewards/LinkBankAccount.tsx`** — New screen:
- Plaid Link SDK for React Native (`react-native-plaid-link-sdk`)
- Opt-in language: "Link your bank to automatically earn TherrCoins when you shop at
  participating businesses"
- Shows nearby participating businesses
- Disconnect option at any time
- Add i18n keys to all 3 locales (en-us, es, fr-ca)

### Phase 2 Gate
- >80% of admin-approved matches have confidence score ≥ 0.90
- No false positive patterns detected in 2-week sample

---

## Phase 3: Semi-Automated Rewards

**Goal**: High-confidence matches auto-award. Rate limiting and anti-fraud. Business analytics.

### Automation Changes

**`therr-services/users-service/src/handlers/plaidWebhooks.ts`** update:
- After writing match, check confidence score against configurable threshold
  (from `main.config` key `plaidAutoAwardThreshold`, default `0.95`)
- If score ≥ threshold: immediately award coins via `Store.users.updateUser()` increment
- Update match record to `status = 'awarded'`
- Emit in-app notification to consumer

**`therr-services/users-service/src/utilities/plaidFraud.ts`** — Anti-fraud checks:
- Max rewards per user/space pair per 30 days (config key `plaidMaxRewardsPerMonth`, default `3`)
- Minimum transaction amount (config key `plaidMinTransactionAmount`, default `5.00`)
- Deduplicate by `plaidTransactionId` (unique constraint blocks replays)
- Velocity alert: flag to admin queue if user earns > N coins in 24h from Plaid sources

**Achievements triggered here** — see "Community Patronage Achievements" section below.

### Business Dashboard Analytics

**`therr-client-web-dashboard/src/`** — New analytics section on space management:
- "Rewarded Visits" count (last 30 days)
- Unique consumers rewarded
- Estimated coin value attributed to location
- CSV export (anonymized — no consumer PII)

### Consumer Notifications

**`therr-services/push-notifications-service/src/locales/{en-us,es,fr-ca}/dictionary.json`**
— New push notification type `plaidCashBackEarned`:
```
"You earned {amount} TherrCoins at {businessName}!"
```

### Phase 3 Gate
- Stable fraud rate (no abuse patterns over 30 days)
- Business adoption of analytics feature

---

## Phase 4: Real Cash Back Payouts

**Goal**: Replace manual gift card fulfillment with automated ACH disbursements.

### Decision: Plaid Transfer vs Stripe Connect

| | Plaid Transfer | Stripe Connect |
|---|---|---|
| **Fit** | Natural — consumer bank already linked in Phase 2/3 | Requires new Connect account per consumer |
| **Identity verification** | Covered by Phase 2/3 enrollment | Requires Stripe KYC |
| **Payout latency** | 1–3 business days (standard ACH) | 2–7 days; instant with fee |
| **Complexity** | Requires Plaid partnership agreement | Familiar API already in use |
| **Recommendation** | ✅ Start here | Revisit if Connect needed elsewhere |

**Chosen**: Plaid Transfer — uses the `access_token` and `account_id` already collected in
Phase 2.

### New Backend Files

**`therr-services/users-service/src/store/migrations/<timestamp>_main.plaidPayouts.js`**

New table `main.plaidPayouts`:
```
  id                   UUID PRIMARY KEY
  userId               UUID NOT NULL FK → users
  plaidTransferId      VARCHAR(255) NOT NULL
  amountUsd            DECIMAL(10, 2)
  coinsDebited         DECIMAL(12, 2)
  status               VARCHAR(20)    -- 'pending'|'settled'|'failed'|'cancelled'
  createdAt            TIMESTAMP WITH TZ DEFAULT NOW()
  updatedAt            TIMESTAMP WITH TZ DEFAULT NOW()
```

**`therr-services/users-service/src/handlers/plaidPayouts.ts`**
- `requestCashOut(req, res)` — triggers ACH transfer for accumulated rewards
- Minimum threshold: `$5.00` (config key `plaidMinCashOutAmount`)
- Converts `settingsTherrCoinTotal` at current exchange rate
- Deducts coins atomically (database transaction, same pattern as `transferTherrCoin`)

**`TherrMobile/main/routes/Rewards/ExchangePointsDisclaimer.tsx`** update:
- Add "Transfer to Bank Account" option (only shown when consumer has linked bank)
- Gift card option retained for non-enrolled users
- Display estimated USD value and minimum threshold notice

---

## Community Patronage Achievements

New achievement class **`localPatron`** — "Supporting Your Community" series.

Achievements are triggered when a Plaid transaction match reaches `status = 'awarded'` in Phase 3.
Progress count tracks total verified purchases at any Therr-enrolled business.

**File**: `therr-public-library/therr-js-utilities/src/config/achievements/localPatron.ts`

| Achievement ID | Title | Trigger | Coins Reward |
|---|---|---|---|
| `localPatron_1_1` | Local Supporter | 1st verified purchase | 5 coins |
| `localPatron_1_1_1` | Neighborhood Regular | 5 verified purchases | 10 coins |
| `localPatron_1_1_2` | Community Champion | 10 verified purchases | 20 coins |
| `localPatron_1_1_3` | Local Hero | 25 verified purchases | 50 coins |
| `localPatron_1_1_4` | Pillar of the Community | 50 verified purchases | 100 coins |

Register in `therr-public-library/therr-js-utilities/src/config/achievements/index.ts`.

Achievement progress incremented when a `plaidTransactionMatches` row transitions to `'awarded'`
status (auto-award in Phase 3, or admin approval in Phase 2).

---

## File Manifest (All Phases)

### Phase 1
| File | Action |
|---|---|
| `therr-services/maps-service/src/store/migrations/<ts>_spaces.plaid.js` | New migration |
| `therr-services/users-service/src/store/migrations/<ts>_main.plaidItems.js` | New migration |
| `therr-services/users-service/src/api/plaid.ts` | New |
| `therr-services/users-service/src/handlers/plaid.ts` | New |
| `therr-services/users-service/src/routes/plaidRouter.ts` | New |
| `therr-services/users-service/src/routes/index.ts` | Modify: mount plaidRouter |
| `therr-api-gateway/src/services/users/router.ts` | Modify: add Plaid routes + rate limiter |
| `therr-client-web-dashboard/src/` | New: Plaid Connect UI component |

### Phase 2
| File | Action |
|---|---|
| `therr-services/users-service/src/store/migrations/<ts>_main.plaidTransactionMatches.js` | New migration |
| `therr-services/users-service/src/handlers/plaidWebhooks.ts` | New |
| `therr-services/users-service/src/utilities/plaidMatching.ts` | New |
| `therr-services/users-service/src/routes/plaidRouter.ts` | Modify: webhook + consumer routes |
| `therr-api-gateway/src/services/users/router.ts` | Modify: webhook route (no auth) |
| `TherrMobile/main/routes/Rewards/LinkBankAccount.tsx` | New |
| `TherrMobile/main/locales/{en-us,es,fr-ca}/dictionary.json` | Modify: i18n keys |
| `therr-client-web-dashboard/src/` | New: admin review queue page |

### Phase 3
| File | Action |
|---|---|
| `therr-services/users-service/src/handlers/plaidWebhooks.ts` | Modify: auto-award logic |
| `therr-services/users-service/src/utilities/plaidFraud.ts` | New |
| `therr-services/push-notifications-service/src/locales/` | Modify: plaidCashBackEarned |
| `therr-client-web-dashboard/src/` | New: business analytics component |
| `therr-public-library/therr-js-utilities/src/config/achievements/localPatron.ts` | New |
| `therr-public-library/therr-js-utilities/src/config/achievements/index.ts` | Modify: register localPatron |

### Phase 4
| File | Action |
|---|---|
| `therr-services/users-service/src/store/migrations/<ts>_main.plaidPayouts.js` | New migration |
| `therr-services/users-service/src/handlers/plaidPayouts.ts` | New |
| `therr-services/users-service/src/routes/plaidRouter.ts` | Modify: payout routes |
| `TherrMobile/main/routes/Rewards/ExchangePointsDisclaimer.tsx` | Modify: bank transfer option |

---

## Environment Variables

```bash
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox                # sandbox | development | production
PLAID_TOKEN_ENCRYPTION_KEY=      # 32-byte hex string for AES-256-GCM
PLAID_WEBHOOK_SECRET=            # For webhook signature validation
```

---

## Exhaustive Test Plan

### Phase 1: Business Enrollment

**Unit tests** (`therr-services/users-service/src/api/plaid.test.ts`):
- `createLinkToken` returns a valid token structure from Plaid sandbox
- `exchangePublicToken` returns `access_token` and `item_id`
- `getIdentity` returns normalized merchant name from sandbox institution
- Token encryption round-trip: encrypt → decrypt → matches original
- Encryption fails with wrong key (AES-GCM authentication tag mismatch)

**Integration tests** (`therr-services/users-service/src/handlers/plaid.test.ts`):
- `POST /plaid/link-token` → 200 with `link_token` for authenticated user
- `POST /plaid/link-token` → 401 for unauthenticated request
- `POST /plaid/business/enroll` → 200 with merchant name stored on space
- `POST /plaid/business/enroll` → 403 when user does not own the space
- `POST /plaid/business/enroll` → 400 when `spaceId` is missing
- `POST /plaid/business/enroll` → 409 when space is already enrolled (idempotency)
- `DELETE /plaid/business/:spaceId` → 200, access token invalidated, space fields cleared
- `DELETE /plaid/business/:spaceId` → 403 for non-owner
- Access token is not present in any HTTP response body (security assertion)
- `main.plaidItems` row created with correct `enrollmentType = 'business'`
- `spaces.plaidMerchantName` is set to Plaid-normalized value (not raw user input)

**Rate limiting tests**:
- 6th enrollment attempt within 1 hour → 429

### Phase 2: Consumer Opt-in & Webhook Processing

**Unit tests** (`therr-services/users-service/src/utilities/plaidMatching.test.ts`):
- Exact merchant name match → confidence score ≥ 0.99
- Minor variation (`"JOE'S PIZZA"` vs `"JOES PIZZA"`) → score ≥ 0.90
- Completely different name → score < 0.50 (no match written)
- Score below 0.85 threshold → no `plaidTransactionMatches` row created
- Score ≥ 0.85 with matching lat/lng → higher score than name-only match
- Score ≥ 0.85 with mismatched lat/lng (different city) → score reduced
- Duplicate `plaidTransactionId` → unique constraint error, graceful handling

**Integration tests** (`therr-services/users-service/src/handlers/plaidWebhooks.test.ts`):
- Valid Plaid webhook signature → 200, transaction processed
- Invalid webhook signature → 401, no processing
- Missing signature header → 401
- `DEFAULT_UPDATE` webhook with new transactions → match records written
- `DEFAULT_UPDATE` webhook with no new transactions → no records written, 200
- Replay of already-processed `transactionId` → 200 (idempotent), no duplicate row
- Webhook for consumer with no enrolled spaces → 200, no match records

**Integration tests** (consumer enrollment):
- `POST /plaid/consumer/enroll` → 200, `plaidItems` row with `enrollmentType = 'consumer'`
- `POST /plaid/consumer/enroll` → 409 when already enrolled
- `DELETE /plaid/consumer` → 200, item revoked, row status set to `'revoked'`
- `GET /plaid/consumer/status` → 200 with `{ enrolled: true }` or `{ enrolled: false }`

**Admin review queue tests**:
- `POST /admin/plaid/matches/:id/approve` → coins awarded, match status → `'awarded'`
- Approving same match twice → 409 (idempotent guard)
- `POST /admin/plaid/matches/:id/reject` → status → `'rejected'`, no coins awarded
- Non-admin calling approve/reject → 403

### Phase 3: Automated Rewards & Anti-Fraud

**Unit tests** (`therr-services/users-service/src/utilities/plaidFraud.test.ts`):
- Transaction amount < `plaidMinTransactionAmount` → blocked, no coins
- User/space pair has hit `plaidMaxRewardsPerMonth` → blocked, queued for review
- Transaction exactly at minimum amount → allowed
- 31st day resets the rolling 30-day window → reward allowed again
- Velocity check: 4th reward from Plaid sources in 24h → flagged to admin queue

**Integration tests** (auto-award):
- High-confidence match (≥ threshold) → coins incremented atomically on `users` table
- Two concurrent high-confidence matches for same user → both awarded without double-spend
  (test with DB transaction isolation)
- Match below threshold → NOT auto-awarded, stays `'pending'`
- Configurable threshold (set `plaidAutoAwardThreshold = 0.99` in config) → match at 0.97
  stays pending
- Achievement progress incremented when match is awarded (Phase 3 hook)
- Push notification sent after auto-award

**Achievement tests** (`therr-js-utilities/src/config/achievements/localPatron.test.ts`):
- First awarded match → `localPatron_1_1` progress = 1, not yet complete
- `countToComplete` = 1 → after 1 award, `completedAt` is set
- `localPatron_1_1_1` prerequisite: requires `localPatron_1_1` completed
- Tier 2 (`localPatron_1_1_1`) not unlocked until tier 1 complete
- `pointReward` values match spec (5, 10, 20, 50, 100)

### Phase 4: Payout Processing

**Unit tests** (`therr-services/users-service/src/handlers/plaidPayouts.test.ts`):
- Payout below minimum threshold → 400 with clear error message
- `settingsTherrCoinTotal` debited atomically before transfer is initiated
- If Plaid Transfer API fails → coins rolled back, `plaidPayouts` row status = `'failed'`
- Transfer success → `plaidPayouts` row status = `'pending'`, coins permanently debited
- `transfer.settled` webhook → status updated to `'settled'`
- `transfer.failed` webhook → status updated to `'failed'`, coins refunded to user
- Consumer without linked bank → 422 with actionable error
- Double payout request (concurrent) → second request blocked by DB transaction lock

**Security tests** (all phases):
- Plaid access token never appears in any API response
- Encrypted token in DB differs from plaintext (basic sanity check)
- Non-owner cannot enroll or revoke a space
- Non-consumer cannot trigger webhook processing on behalf of another user
- SQL injection attempt in `merchantName` field → sanitized, no query manipulation
- Admin-only endpoints return 403 for regular users and 401 for unauthenticated requests

---

## Phasing Rationale

| Phase | Risk | Value | Gate |
|---|---|---|---|
| 1 | Very low (no automation, no consumer exposure) | Merchant registry + data quality validation | 10+ businesses enrolled |
| 2 | Low (manual review before any coins move) | Full loop validation with real data | >80% admin-approved match rate |
| 3 | Medium (automation with fraud guards) | Scalable reward loop + community achievements | Stable fraud rate over 30 days |
| 4 | Higher (real money movement) | True cash back product | Legal/compliance review of Plaid Transfer |
