# Therr App - Feature List

**Last Updated:** March 2026
**Scope:** TherrMobile (React Native) and therr-client-web (React SSR)

> **For AI agents:** Update this file whenever you add, remove, or significantly change a feature.
> Keep entries to one line each. This document is intentionally concise to minimize context usage.

---

## Platform-Wide Features (Mobile + Web)

### Authentication & Accounts
- **Email/password registration & login** — with email verification code flow
- **Google OAuth** — social sign-in on both platforms
- **Apple OAuth** — social sign-in (mobile)
- **Phone verification** — optional during profile creation
- **Password reset** — forgot-password email flow
- **Account types** — personal, business, and creator accounts
- **Organization management** — business account grouping

### User Profiles
- **Profile editing** — name, bio, profile picture, privacy settings
- **View other users** — public profile with content tabs (spaces, events, thoughts)
- **User search & discovery** — search by username, "people you may know" suggestions
- **Social sync** — link Twitter and YouTube accounts

### Social & Connections
- **User connections** — friend requests with 5 types (blocked, removed, pending, accepted, friend)
- **Direct messaging** — real-time 1-on-1 chat via WebSocket (Socket.IO)
- **Groups/Forums** — create/join public or private communities with admin/moderator roles
- **Group chat** — real-time forum messaging within groups
- **Group events** — events associated with a group
- **Invite friends** — referral system with TherrCoin rewards

### Location-Based Content
- **Moments** — geo-tagged ephemeral photo posts; proximity-gated visibility, max view limits
- **Spaces** — persistent location/business pages; claim storefronts, menu/reservation/order URLs, ratings, check-ins
- **Events** — time-bound location happenings; start/stop scheduling, group/space association
- **Thoughts** — micro-posts with categories, reply threads, mentions, hashtags
- **Content categories** — 20+ categories (food, music, nature, art, gaming, etc.)
- **Media uploads** — image upload with CDN (ImageKit), YouTube video embedding

### Engagement & Reactions
- **Reactions** — like, dislike, super-like, super-dislike on all content types
- **Bookmarks** — save content for later; browse saved items by type
- **Ratings** — 1-5 star ratings for spaces and events
- **Check-ins** — check in at spaces (with valuation tiers for rewards)
- **Content reporting** — flag content for moderation
- **Content sharing** — share URLs to external platforms

### Gamification & Rewards
- **Achievements** — 12 classes (explorer, influencer, socialite, communityLeader, eventPlanner, activist, journalist, tourist, tourGuide, thinker, humanitarian, critic) with tiered progression
- **TherrCoin currency** — earned through social actions, check-ins, referrals
- **XP system** — experience points from achievements
- **Points exchange** — redeem accumulated rewards

### Notifications
- **Push notifications** — Firebase Cloud Messaging; location-triggered, brand-specific templates
- **In-app notifications** — real-time via WebSocket; mark read, notification history
- **Notification channels** — default, content discovery, reward updates, reminders (Android)

### Campaigns & Business Tools
- **Campaigns** — create/manage marketing campaigns with status tracking and ad goals
- **Geo-fenced promotions** — location-targeted deals for businesses
- **Featured incentives** — promote spaces with special offers
- **Space metrics** — engagement analytics for business owners

### Offline & Resilience
- **Offline content viewing** — cached content (spaces, moments, thoughts, notifications) displayed when offline via redux-persist
- **Network status detection** — real-time connectivity monitoring (NetInfo on mobile, window events on web)
- **Offline banner** — dismissable UI indicator when device is offline
- **Graceful degradation** — GET requests fail silently with cached data; no blank screens during outages

### Settings & Preferences
- **Theme selection** — light, dark, retro
- **Language selection** — en-us, es (mobile); en-us, es, fr-ca (web)
- **Notification preferences** — per-channel enable/disable
- **Mature content filter** — toggle visibility of mature content

### Payments
- **Stripe integration** — web/subscription payments
- **In-app purchases** — iOS App Store and Google Play support

---

## TherrMobile-Only Features

- **Interactive map** — real-time location discovery with custom markers, clustering, geo-filtering, and map action buttons
- **GPS location services** — continuous location tracking with permission management
- **Check-in with throttling** — time-gated check-ins at spaces
- **Activity generator** — interest-based activity suggestions
- **Activity scheduler** — plan and schedule activities
- **Phone contacts integration** — sync contacts for friend invitations
- **Camera & image picker** — capture/select photos with crop and compression
- **Get directions** — open native maps for navigation to locations
- **Haptic feedback** — vibration feedback on key interactions
- **Secure storage** — encrypted local storage for sensitive data
- **Location disclosure modal** — privacy explanation for location permissions
- **Nearby content carousels** — swipeable tabs for discoveries, events, thoughts, news
- **Draft management** — save and resume content drafts
- **Animated onboarding** — landing page with background carousel

---

## therr-client-web-Only Features

- **Server-side rendering (SSR)** — Express-based SSR for SEO and performance
- **Locale-prefixed URL routing** — `/`, `/es/`, `/fr-ca/` with automatic detection
- **SEO optimization** — dynamic meta tags, canonical URLs, hreflang links per locale
- **Leaflet.js map** — interactive map for browsing spaces with lazy loading
- **Email preferences** — unsubscribe page for marketing, activity, likes, invites, mentions, messages, reminders
- **App feedback survey** — feature feedback form (social health, loyalty rewards, missing features)
- **Child safety page** — CSAE prevention policy and reporting information
- **Delete account page** — self-service account and data deletion
- **Invite landing pages** — referral URLs with bonus coin redemption
- **Explore hub** — central discovery page with moments, spaces, thoughts, and people tabs
- **Space management** — list and manage all user-created spaces
- **Discovered feed** — recently shared community content
- **Progressive image loading** — optimized media delivery
- **Accessibility** — ARIA labels, alt text, semantic HTML, color scheme toggle

---

## Feature Flags (Niche App Configuration)

These flags control which features are enabled per brand variant. Set in `TherrMobile/env-config.js` or equivalent web config.

| Flag | Controls |
|------|----------|
| `ENABLE_MAP` | Interactive map tab and location discovery |
| `ENABLE_AREAS` | Content browsing (moments, spaces, events nearby) |
| `ENABLE_GROUPS` | Groups/forums tab |
| `ENABLE_CONNECT` | People discovery and friend requests |
| `ENABLE_MOMENTS` | Moment creation and viewing |
| `ENABLE_SPACES` | Space/location creation and viewing |
| `ENABLE_EVENTS` | Event creation and viewing |
| `ENABLE_THOUGHTS` | Thought creation and viewing |
| `ENABLE_DIRECT_MESSAGING` | 1-on-1 messaging |
| `ENABLE_ACHIEVEMENTS` | Achievement tracking and rewards |
| `ENABLE_ACTIVITIES` | Activity generator |
| `ENABLE_ACTIVITY_SCHEDULER` | Activity scheduling |
| `ENABLE_NOTIFICATIONS` | Notification center |
| `ENABLE_FORUMS` | Forum messaging within groups |

---

## Niche App Extensions

### Habits System (Friends with Habits — `BrandVariations.HABITS`)

- **Habit goals** — create from templates or custom; frequency config (daily/weekly/custom), target days
- **Pacts** — accountability partnerships; invite partners, set consequences (donation/dare/custom)
- **Habit check-ins** — daily completion tracking with photo/video/note proof
- **Streaks & milestones** — streak counting, milestone events, celebration triggers
- **Real-time pact updates** — WebSocket events for partner check-ins, celebrations, encouragement
- **Pact status management** — pending, active, completed, abandoned lifecycle

---

## Brand Variations

All variants share the same backend and auth system. Current variants defined in `BrandVariations` enum:

| Variant | Key | Description |
|---------|-----|-------------|
| Therr | `therr` | Core location-based social network |
| Friends with Habits | `habits` | Accountability and habit tracking |
| Teem | `teem` | Community/team features |
| Otaku | `otaku` | Niche interest communities |
| Appy Social | `appy_social` | General social variant |
| Parallels | `parallels` | Alternative social experience |
