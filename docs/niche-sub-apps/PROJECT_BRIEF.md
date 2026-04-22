# Therr App - PROJECT BRIEF & DEVELOPMENT CONTEXT

**Last Updated:** April 2026
**Project Status:** Active Development — B2B-First Strategy
**Developer:** Solo founder with full-time job and family commitments

---

## EXECUTIVE SUMMARY

**What We're Building:**
Therr App is a location-based social network that connects people through proximity and shared spaces. Unlike traditional social networks that focus on follower counts and global reach, Therr emphasizes local-first community building, in-person interactions, and discovering content from friends when you're physically near where it was posted.

**Why This Project Exists:**
Modern social networks have created a paradox: we're more "connected" than ever yet increasingly isolated. Therr addresses this by rewarding real-world engagement over passive scrolling. The platform incentivizes users to explore their local communities, support nearby businesses, and build meaningful connections with people who share their physical spaces.

**Core Innovation:**
Therr introduces proximity-gated content and social matching. Content "activates" when you're near where it was posted, creating a treasure-hunt dynamic that encourages exploration. The Match Up feature connects users with nearby friends who share common interests, while businesses can claim digital storefronts and geo-fence promotions to drive foot traffic.

**Therr Family of Apps:**
This core codebase serves as the foundation for multiple niche app variants (e.g., Friends With Habits, Teem). Each niche app inherits the core social infrastructure while adding specialized branding, content filtering, and feature customizations controlled by feature flags. All apps share the same authentication API and database, allowing users to move seamlessly between experiences.

---

## PRODUCT VISION

### Core Concept
"A social network that connects people by proximity through the distance of time." Therr transforms how people discover and share experiences by tying content to physical locations and rewarding in-person engagement.

### Key Value Propositions

**For Users:**
- Discover posts from friends only when near where they were shared
- Match with nearby friends who share your interests
- Earn rewards for check-ins and local business engagement
- Keep locations private while still building local community
- Get personalized recommendations for hangout spots and social events

**For Businesses:**
- Claim a digital storefront and create geo-fenced promotions
- Attract foot traffic with location-targeted deals and discounts
- Connect with customers who are physically nearby
- Build authentic local community engagement

### Platform Pillars

1. **Proximity-First:** Content and connections are tied to physical presence
2. **Reward Real Engagement:** Incentivize in-person interactions over passive scrolling
3. **Local Community Building:** Foster neighborhood-level connections
4. **Privacy by Design:** Users control location visibility while maintaining authenticity
5. **Business Integration:** Bridge online discovery with offline commerce

### The Therr Difference

| Traditional Social Networks | Therr App |
|---|---|
| Global reach, shallow connections | Local focus, meaningful connections |
| Passive content consumption | Active exploration and discovery |
| Metrics: likes, followers | Metrics: real-world engagement |
| Rewards attention | Rewards presence |
| Ghost town local groups | Vibrant proximity-based communities |

---

## CURRENT STATE (April 2026)

### What Was Accomplished (Q1 2026 Revitalization)
After a period of reduced activity, a focused month of revitalization work completed:
- **SEO overhaul**: Keyword-rich URL slugs, structured data, OG tags, hreflang, category landing pages
- **Performance**: SSR optimizations, progressive image loading, lazy-loaded map components
- **Mobile refinements**: Android app updated and republished on Google Play
- **Reduced friction**: Streamlined onboarding, improved registration flow
- **B2B infrastructure**: Business listing pages, claim flow, Stripe subscription checkout (3 tiers: $14.99/$34.99/$99.99/mo)
- **Data enrichment scripts**: OSM import pipeline, email sourcing from business websites, deduplication logic
- **Outreach email pipeline**: `sendUnclaimedSpaceEmail` function built, tested, and translated in 3 languages

### Current Platform Status
- ~50 Android installs (very low — starting from near-zero)
- iOS app not yet published (new Apple Developer account required)
- Business listings indexed by Google via SSR + sitemap
- Email outreach pipeline ready to activate (`scripts/import-spaces/send-unclaimed-emails.ts`)
- Subscription checkout live with Stripe webhooks

---

## GROWTH STRATEGY (B2B-First)

The viable growth path for a solo developer is a **B2B-first local business directory** strategy, not consumer social network growth. See `docs/GROWTH_STRATEGY.md` for the full strategy.

### Core Insight
Location-based social apps have the worst cold-start problem of any app category. However, local business directories (Yelp, Google Business Profile, Foursquare) grow through SEO and outreach — not user virality. The platform already functions as a directory. The goal is to convert that into revenue.

### The 90-Day Goal
**1 business paying $14.99/month.** This single payment validates the entire funnel.

### Monetization Tiers
- **Basic** ($14.99/mo): Enhanced listing, analytics, priority support
- **Advanced** ($34.99/mo): Geo-fenced promotions, campaign tools
- **Pro** ($99.99/mo): Full campaign management, influencer pairing, premium visibility

### Consumer Growth
Core Therr social layer grows passively via:
- Business owners sharing their Therr page with existing customers
- SEO organic traffic landing on space pages
- Friends With Habits (FwH) niche app as primary consumer growth vehicle

---

## NICHE APP FAMILY

| App | Branch | Status | Primary Focus |
|-----|--------|--------|---------------|
| Therr App (core) | `general`/`main` | Active — B2B-first | Local business directory + social |
| Friends With Habits | `niche/HABITS-general` | Active — PRIMARY consumer focus | Mandatory accountability habit tracker |
| Teem | `niche/TEEM-general` | Paused | Team collaboration |

See `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` for the FwH development roadmap.

---
