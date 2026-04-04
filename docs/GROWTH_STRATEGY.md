# Therr App — Growth Strategy

**Last Updated:** April 2026  
**Status:** Active — B2B outreach pipeline ready to launch

---

## Summary

The viable growth path for a solo developer with a full-time job is a **B2B-first local business directory** strategy. Consumer social network growth (the original vision) requires critical geographic density that is not achievable without dedicated marketing budget and time. The B2B directory model grows through SEO and outreach — both of which can be automated or run asynchronously.

**The 90-day validation milestone:** 1 business paying $14.99/month.

---

## The B2B Funnel (End-to-End)

```
1. Email outreach  →  business owner receives "People are searching for {spaceName}"
2. Landing page    →  business sees their real, indexed space page (therr.com/spaces/{id}/{slug})
3. Claim flow      →  "Is this your business? Claim it free" banner + CTA section
4. Registration    →  create account or log in (returnTo= preserves space URL)
5. Claim review    →  admin approves claim request (manual, takes ~minutes)
6. Dashboard       →  business owner lands on therr-client-web-dashboard
7. Pricing page    →  three subscription tiers ($14.99/$34.99/$99.99/mo)
8. Stripe checkout →  payment → webhook → subscription tier activated
```

All steps exist and are functional. The only step not yet automated is Step 1.

---

## Email Campaign

### The Script
`scripts/import-spaces/send-unclaimed-emails.ts` — runnable CLI that:
- Queries maps-service DB for unclaimed spaces with `businessEmail` populated
- Checks deduplication via users-service DB (`main.userMetrics`)
- Checks bounce/blacklist via users-service DB (`main.blacklistedEmails`)
- Sends via AWS SES with a clean HTML email
- Writes the sent metric for deduplication on future runs

**Run the first campaign:**
```bash
# Test first (no sends, no writes)
npx ts-node scripts/import-spaces/send-unclaimed-emails --dry-run --limit 5

# Send first batch — start slowly to warm up SES reputation
npx ts-node scripts/import-spaces/send-unclaimed-emails --city chicago --limit 50
```

### Email Deliverability
- Start at 50/day — SES sender reputation requires warm-up
- Monitor AWS SES dashboard for bounce rate; stay under 5%
- Bounce handling is already implemented in `therr-services/users-service/src/routes/emailsRouter.ts`
- Deduplication prevents duplicate sends (enforced by metric)

### The B2B Pitch (Three Layers)
1. **Immediate (free):** "Your business already has a page on Therr that appears in Google search results. Claim it to control your information."
2. **Near-term (free):** "When customers search for [category] near [city], your Therr listing appears."
3. **Paid (future):** "As our user base grows in your area, your listing converts to geo-targeted promotions and check-in rewards. Early claimers lock in lowest rate."

This pitch is honest — it doesn't depend on current user counts. Business owners can verify their listing exists before being asked to pay anything.

### Claim Flow UX (Recent Improvement)
The space page now shows a prominent banner when arriving from the outreach email (`?claim=true` param):
- Visible immediately at the top of the page
- Shows email-specific title and body copy
- "Claim This Space" button scrolls to the claim section
- Dismissable — doesn't block the page

---

## SEO Strategy

### What's Already Built
- SSR web client with proper OG tags, geo.position meta, Twitter cards, hreflang
- Slug-based URLs: `therr.com/spaces/{id}/joes-pizza-chicago-il`
- Category landing pages: `/locations/restaurants`, `/locations/fitness-sports`, etc.
- Paginated XML sitemaps for spaces, events, groups
- OSM import pipeline with 20 configured cities (Chicago, LA, NYC, Seattle, etc.)

### Priority Actions
1. **Submit sitemap to Google Search Console** (10 minutes — do this first)
2. **Enrich imported spaces**: Run `scripts/import-spaces/source-emails-websites.ts` to add photos, website links, and emails for existing spaces. Richer content = higher rankings.
3. **Concentrate data**: 200 enriched spaces in Chicago > 20 spaces across 10 cities. Focus the first email campaign on a single well-populated city.
4. **City-category landing pages** (future): `/locations/restaurants/chicago` — matches the commercial-intent searches with highest volume.

### What NOT to Do
- Do not create thin placeholder pages
- Do not try to rank for "social network" or "geo-social app" keywords
- Do not build a blog for traffic (slow, wrong audience, high time cost)

---

## Consumer Growth Strategy

Consumer social network growth (dense proximity-based content) requires geographic density that is not achievable as a side project without paid acquisition. The strategy is:

1. **Passive growth via B2B**: When businesses claim their listing and share their Therr page with existing customers, that creates organic sign-ups.
2. **SEO organic traffic**: Users arriving via Google search on space pages will occasionally register.
3. **Friends With Habits (primary)**: The FwH niche app has a viral loop that works with 2 users (pact mechanic), not geographic density. This is the consumer growth vehicle. See `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md`.

**Do not** invest time in consumer-facing marketing for core Therr until B2B has validated revenue.

---

## Prioritized Action Queue

| Priority | Action | Estimated Time | Leverage |
|----------|--------|---------------|---------|
| 1 | Submit sitemap to Google Search Console | 10 min | High — ongoing indexing insight |
| 2 | Register Apple Developer account + iOS submission | 2-4 hrs | High — removes iOS gap from B2B pitch |
| 3 | Run OSM import for Chicago/LA at scale | 1 hr setup | High — builds email inventory |
| 4 | Run `source-emails-websites` for highest-density city | Overnight cron | High — populates businessEmail |
| 5 | Run first email batch (`--city chicago --limit 50`) | 30 min | Critical — validates the funnel |
| 6 | Monitor SES bounce rate + claim initiations over 7 days | Passive | Critical signal |
| 7 | City-category landing pages `/locations/{cat}/{city}` | 4-6 hrs | Medium — compounding SEO |
| 8 | Post-claim referral link via `InviteCodesStore` | 2-3 hrs | Medium — consumer growth lever |

---

## Go / No-Go Criteria (90 Days)

### Green — Keep Investing
- Email open rate: **5%+** from first 500 sends
- Claim initiations: **1%+** (5+ businesses start claim flow)
- First paid subscription within **90 days**
- Google Search Console shows **500+ impressions/month** for space pages within 60 days

### Yellow — Investigate Before Investing More
- Open rates < 2%: deliverability/SES reputation problem, not product problem
- Claims initiated but not completed: registration friction is the blocker
- Paid subscription with no dashboard usage: value proposition unclear

### Red — Reconsider
- 1,000 emails sent, zero claim initiations
- 5+ claims, zero paid conversions within 6 months
- Space pages not indexed by Google after 90 days

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `scripts/import-spaces/send-unclaimed-emails.ts` | Email outreach CLI — the central activation script |
| `scripts/import-spaces/source-emails-websites.ts` | Scrapes business emails from websites |
| `scripts/import-spaces/index.ts` | OSM import — populates spaces from OpenStreetMap |
| `scripts/import-spaces/config.ts` | 20-city bounding box configuration |
| `therr-services/users-service/src/api/email/for-business/sendUnclaimedSpaceEmail.ts` | Email function (used by service layer) |
| `therr-client-web/src/routes/ViewSpace.tsx` | Space detail page with claim banner + CTA |
| `therr-client-web-dashboard/src/components/PricingCards.tsx` | Subscription tier presentation |
| `therr-services/users-service/src/routes/emailsRouter.ts` | Bounce handling (already live) |
