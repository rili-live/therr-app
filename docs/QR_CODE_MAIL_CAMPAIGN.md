# Physical QR Code Mail Campaign

## Overview

Business owners who claim their space on Therr can opt in to receive a **physical QR display** (coaster, table tent, or window cling) to place in their venue. Customers scan the code to check in on Therr, earn rewards, and amplify the business to their friend network.

This creates a flywheel:
- Business owner gets a tangible, low-effort marketing tool
- Customers discover the rewards system at the point of visit
- Each check-in generates organic social discovery for the business
- Therr gains real-world user acquisition without digital ad spend

---

## Display Options

Business owners select one option at the time of claiming or from their dashboard:

| Option | Description | Suggested Size |
|--------|-------------|----------------|
| **Coaster** | Double-sided coaster; QR on one face, Therr branding + tagline on other | 3.5" diameter |
| **Table tent** | Foldable A6 stand; front = QR + CTA, back = reward explainer | A6 (4.1" × 5.8") folded |
| **Window cling** | Static cling for storefront window; highly visible from street | 4" × 4" |

**Copy to use on all items:**
> "Scan to earn rewards here and there on Therr App"

QR code should link to: `https://therr.app/spaces/{spaceId}?checkin=true`

---

## Implementation Steps

### Phase 1 — Dashboard Selection UI

1. Add a "Request a Display Kit" section to the business owner dashboard (`therr-client-web-dashboard`)
2. Show the three display options with preview images
3. Record the selection in the database (see schema below)
4. Confirm mailing address (pre-fill from space `addressStreetAddress`, `addressLocality`, `addressRegion`, `postalCode`)
5. Send a confirmation email to `businessEmail` on the space

**Database change needed** — add to `main.spaces` or a new `main.spaceDisplayRequests` table:

```sql
CREATE TABLE main.spaceDisplayRequests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spaceId     UUID NOT NULL REFERENCES main.spaces(id),
    fromUserId  UUID NOT NULL,
    displayType VARCHAR(20) NOT NULL CHECK (displayType IN ('coaster', 'table_tent', 'window_cling')),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'printed', 'shipped', 'delivered', 'cancelled')),
    shippingName        VARCHAR(120),
    shippingAddress     VARCHAR(200),
    shippingCity        VARCHAR(100),
    shippingRegion      VARCHAR(100),
    shippingPostalCode  VARCHAR(20),
    shippingCountry     VARCHAR(10) DEFAULT 'US',
    trackingNumber      VARCHAR(100),
    requestedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shippedAt   TIMESTAMPTZ,
    deliveredAt TIMESTAMPTZ,
    notes       TEXT
);

CREATE INDEX ON main.spaceDisplayRequests (spaceId);
CREATE INDEX ON main.spaceDisplayRequests (status);
CREATE INDEX ON main.spaceDisplayRequests (requestedAt);
```

### Phase 2 — QR Code Generation

Each QR code encodes the deep link to the business's space page:

```
https://therr.app/spaces/{spaceId}?checkin=true
```

The `checkin=true` param can trigger an auto-prompt to check in on arrival (future enhancement).

QR codes can be generated server-side using a library like `qrcode` (npm) or via a service like QR Tiger / Canva for branded designs during the MVP phase.

**MVP approach:** Generate QR codes on demand from an admin script using the `qrcode` npm package, export as high-res PNG, and embed into print templates (Canva, Figma, or InDesign).

### Phase 3 — Fulfillment Workflow

**MVP (manual):**
1. Admin queries the `spaceDisplayRequests` table for `status = 'pending'` records
2. Pull a CSV export to send to a print-on-demand vendor (e.g., Moo.com, Sticker Mule, GotPrint)
3. Mark records as `printed` after order is placed, `shipped` with tracking number, `delivered` once confirmed
4. Print vendors typically handle bulk coasters and table tents at $0.50–$2.00 per unit at volume

**Scaled approach:**
- Integrate with a print-on-demand API (e.g., Printful, Prodigi) triggered automatically when a display request is submitted
- Webhook back from fulfillment partner to update `status` and `trackingNumber`

### Phase 4 — Admin View

Add a simple admin table in `therr-client-web-dashboard` showing:
- Business name, space ID
- Display type requested
- Shipping address
- Status (with ability to update)
- Tracking number (editable)

Sort by `requestedAt DESC`. Filter by status.

---

## Managing the Business List

### Querying pending requests

```sql
SELECT
    r.id,
    r.displayType,
    r.status,
    r.requestedAt,
    r.shippingName,
    r.shippingAddress,
    r.shippingCity,
    r.shippingRegion,
    r.shippingPostalCode,
    s.notificationMsg  AS businessName,
    s.id               AS spaceId
FROM main.spaceDisplayRequests r
JOIN main.spaces s ON r.spaceId = s.id
WHERE r.status = 'pending'
ORDER BY r.requestedAt ASC;
```

### CSV export for print vendor

```sql
COPY (
    SELECT
        r.shippingName,
        r.shippingAddress,
        r.shippingCity,
        r.shippingRegion,
        r.shippingPostalCode,
        r.shippingCountry,
        r.displayType,
        s.id AS spaceId
    FROM main.spaceDisplayRequests r
    JOIN main.spaces s ON r.spaceId = s.id
    WHERE r.status = 'pending'
) TO '/tmp/display_requests.csv' WITH CSV HEADER;
```

---

## Foot Traffic Metrics for Monthly Digest

The `spaceMetrics` table stores check-in events with user location. This supports the monthly foot-traffic digest email (implemented separately in `therr-messaging-automator`).

**Available metric names** (from `MetricNames` enum):
- `space.user.checkIn` — explicit check-in with lat/lng
- `space.user.visit` — passive visit event
- `space.user.impression` — space was shown to a nearby user
- `space.user.prospect` — user was within proximity

**Query: unique check-ins within 100m of a space in the past 30 days**

```sql
SELECT COUNT(DISTINCT sm."userId") AS foot_traffic
FROM main."spaceMetrics" sm
JOIN main.spaces s ON sm."spaceId" = s.id
WHERE sm."spaceId" = $1
  AND sm.name = 'space.user.checkIn'
  AND sm."createdAt" >= NOW() - INTERVAL '30 days'
  AND ST_DWithin(
      sm."userLocation"::geography,
      s."geomCenter"::geography,
      100
  );
```

**Existing API endpoint:** `GET /space-metrics/:spaceId?startDate=&endDate=&metricNames=`
- Returns daily aggregates and % change vs. prior period
- Access-controlled: only the space owner or org admins can query

The messaging automator should call this endpoint (or run the query directly against the read replica) to populate the "X customers checked in near your space last month" figure in the digest email.

---

## Phased Rollout

| Phase | Trigger | Action |
|-------|---------|--------|
| **0 — Pilot** | Manual outreach to 5–10 early claimers | Send displays by hand; validate interest |
| **1 — Opt-in** | Dashboard "Request a Kit" button live | Collect requests; batch-print weekly |
| **2 — Automated** | Print-on-demand API integration | Fulfill automatically within 48h of request |
| **3 — Proactive** | Business claims space → auto-offer kit via email | Maximizes conversion with zero extra clicks |

---

## Cost Estimate (per unit, US)

| Item | Unit Cost (est.) | Vendor Examples |
|------|-----------------|-----------------|
| Coaster (pack of 50) | ~$0.60–$1.20 each | Moo.com, GotPrint |
| Table tent (A6, 50 qty) | ~$0.80–$1.50 each | Sticker Mule, GotPrint |
| Window cling (4"×4", 25 qty) | ~$1.50–$3.00 each | Sticker Mule, StickerYou |
| Shipping (USPS First Class) | ~$1.00–$3.00 per envelope | — |

At pilot scale (10 businesses, mixed items), total cost is well under $100.
