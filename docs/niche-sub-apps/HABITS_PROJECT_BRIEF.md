# Friends With Habits - PROJECT BRIEF & DEVELOPMENT CONTEXT

**Last Updated:** April 2026  
**Project Status:** Active Development — Primary Consumer Focus  
**Developer:** Solo founder with full-time job and family commitments

---

## EXECUTIVE SUMMARY

**What We're Building:**  
'Therr: Friends With Habits' is an accountability-based habit tracker where users MUST invite friends to create "pacts" together. The mandatory social mechanic creates viral growth without marketing spend.

**Why This Project Exists:**  
Friends With Habits is a niche variant of Therr App built on the same monorepo infrastructure. It repurposes 60% of the existing social infrastructure to enter a lower-competition market with built-in viral mechanics. Authorization uses the same API and database, allowing users to authenticate to either app interchangeably. 'Therr: Friends With Habits' is the primary consumer-facing app in the Therr, Inc. family.

**April 2026 Strategic Direction:**  
Core Therr App is pursuing a B2B-first strategy (local business directory → email outreach → paid subscriptions). Friends With Habits is the primary consumer-focused niche app and will receive active development on the `niche/HABITS-general` branch. The niche branch is being rebased and development will accelerate.

**Therr Family of Apps:**
These niche apps are a branch and/or child app of Therr App. The general idea is for a niche app to inherit the core foundations of Therr with unique, niche branding, content filtering specific to that branding, and some simple customizations that are controlled by feature flags.

**Core Innovation:**  
Unlike traditional habit trackers (solo experience), 'Therr: Friends With Habits' makes accountability partners mandatory. You literally cannot use the app without inviting at least one friend. This creates exponential organic growth.

---

## PROJECT CONSTRAINTS (CRITICAL)

### Developer Constraints
- **Time:** 10-15 hours/week (evenings only - maintainer has separate full-time job + growing family)
- **Sales:** Zero sales ability/experience, no time for outreach or networking
- **Marketing:** No budget, no social media expertise
- **Team:** Solo developer (no cofounders, no employees)

### Technical Constraints
- **Existing Codebase:** Built on Therr App mono repo (React Native, Node.js, Typescript) [https://github.com/rili-live/therr-app]
- **Development Speed:** Relying heavily on Claude Code for AI-assisted development
- **Timeline:** 8-12 weeks to MVP launch
- **Resources:** Bootstrapped, minimal external costs

### Success Requirements
- **Must be monetizable within 3-6 months**
- **Must grow organically without paid marketing**
- **Must leverage existing technical infrastructure**
- **Must not require ongoing sales effort**

---

## MARKET OPPORTUNITY

### Market Size
- Global habit tracking market: **$11.4B (2024) → $43.9B (2034)**
- CAGR: **14.4% annually**
- US market: **$5.4B (2024) → $20.8B (2034)**
- 65% of users actively monitor routines
- 48% increase in adult engagement over past year

### The Accountability Gap
- **95% success rate** with accountability partner
- **10% success rate** without accountability partner
- Current habit trackers are primarily solo experiences
- No dominant player in mandatory-social habit tracking

### Competition Analysis
**Existing Players (All Solo-Focused):**
- Streaks, Habitify, Productive, Done, Way of Life, Pact
- None enforce social accountability
- All allow users to work alone

**Why We'll Win:**
- First-mover in mandatory accountability space
- Viral growth built into product (not optional)
- Leveraging proven $11B+ market
- Lower customer acquisition cost (near $0)

---

## PRODUCT VISION

### Core Concept
"The habit tracker that actually works because your friends hold you accountable. Create pacts/bonds with friends, track together, and face real consequences if you break your streak."

### The Viral Loop (Zero Marketing Required)
1. User downloads app
2. **Cannot create habits alone** - MUST invite friend to create first "pact/bond"
3. Friend receives invite → installs app
4. Both users active → habits stick → success posts to feed
5. User wants another habit → creates new pact → invites another friend
6. Friends see pact updates → FOMO → download app
7. **Exponential growth (viral coefficient >1.0)**

### Key Differentiator
Making social accountability **MANDATORY, not optional**. This is uncomfortable but necessary for viral growth. Users can't skip it - the app doesn't work without partners.

---

## PRODUCT FEATURES

### MVP (Weeks 3-6) - FREE TIER
- ✅ Create **1 active pact** at a time
- ✅ Invite friends to be accountability partners (REQUIRED)
- ✅ Daily check-in system with photo/note proof
- ✅ Activity feed showing partner progress
- ✅ Push notifications when partner completes/misses
- ✅ Basic streak tracking
- ✅ Weekly summary email

### PREMIUM TIER ($6.99/month)
- ✅ **Unlimited active pacts**
- ✅ Custom consequences with auto-enforcement
- ✅ Video proof of habit completion
- ✅ Advanced analytics and insights
- ✅ Create public community challenges
- ✅ Integration with Apple Health/Google Fit
- ✅ Custom habit templates
- ✅ Priority support

### Phase 2 Features (Post-Launch)
- 'Friends with Habits' tournaments and competitions
- Cash stakes option (winners split pot)
- Corporate wellness programs ($99-199/month per company)
- Habit coaches marketplace
- Custom branded white-label versions
- API for third-party integrations

---

## TECHNICAL FOUNDATION

### Existing Infrastructure (From Therr App)
**What We Already Have (60% Built):**
- ✅ User authentication & profiles
- ✅ Social infrastructure (friends, feeds, connections)
- ✅ Rewards/points systems (repurpose for streaks)
- ✅ Check-in mechanisms (repurpose for habit check-ins)
- ✅ Push notifications and reminders
- ✅ Real-time updates and activity feeds
- ✅ Image/media upload capabilities
- ✅ Group functionality (repurpose for pacts)

**What Needs to Change:**
- ❌ Disable location/map features with config/feature flags
- ❌ Simplify social feed to pact-specific updates
- ➕ Add habit templates and tracking logic
- ➕ Build consequence enforcement system
- ➕ Create referral/invite mandatory flow
- ➕ Add payment processing for premium tier

### Technology Stack
- **Frontend:** React Native (cross-platform mobile)
- **Backend:** Node.js
- **Database:** Postgres
- **Authentication:** OAuth, Google/Apple SSO
- **Payments:** In-app purchases (iOS App Store, Google Play, Stripe)
- **Notifications:** Firebase Cloud Messaging push notification service
- **Development:** Claude Code for AI-assisted development with CircleCI deployment pipeline

---

## EXECUTION ROADMAP

> **Note (April 2026):** The original 12-week timeline (Jan 6 → March 24, 2025) has passed.
> Phase 1 foundation work is complete. The roadmap below reflects the current backlog
> with phases restructured around available side-project time (~10-15 hrs/week).

### Phase 1: Foundation ✅ COMPLETE
**Goal:** Prepare codebase for rapid AI-assisted development

- [x] Make mono repo fully Claude Code compatible
- [x] Add regression tests across the repo to keep core api, base app, and sub-apps aligned
  - [x] Implement regression tests for main functionality of users-service
  - [x] Implement regression tests for main functionality of messages-service
  - [x] Implement regression tests for main functionality of reactions-service
  - [x] Implement regression tests for main functionality of push-notifications-service
  - [x] Implement regression tests for main functionality of websocket-service
  - [x] Implement regression tests for main functionality of therr-api-gateway-service
  - [x] Implement regression tests for main functionality of TherrMobile React Native codebase
- [ ] Upgrade dependencies to latest stable versions
  - [x] Fix peer dependency conflicts (ts-node upgraded to 10.x, react-chartist overrides added)
  - [x] Update dev dependencies within major versions (babel 7.28, typescript 5.9, eslint plugins, typings)
  - [x] Update stylelint to 16.x with SCSS config
  - [x] Resolve linting errors from updated packages
  - [x] Update React 18.2 to 18.3 (minor, safe to do)
  - [ ] Evaluate React 19 upgrade (major - requires refactoring, defer until stability)
  - [ ] Update react-router-dom from 6.3 to 6.x latest (within major version)
  - [ ] Update Redux Toolkit from 1.9 to 2.x (major - requires migration, plan separately)
  - [ ] Replace deprecated react-chartist with modern charting library (recharts or react-chartjs-2)
  - [x] Update webpack from 5.x to latest 5.x (safe within major)
  - [x] Audit and address remaining npm vulnerabilities
- [x] Set up modular feature flag system for TherrMobile (utilizing TherrMobile/env-config.js)
  - [x] Define FeatureFlags enum, types, and brand-specific configs in therr-js-utilities (created `constants/enums/FeatureFlags.ts` with flag names like `ENABLE_MAP`, `ENABLE_AREAS`, `ENABLE_GROUPS`, etc.)
  - [x] Centralize brand variation and create FeatureFlagContext (moved hardcoded `BrandVariations.THERR` from Layout.tsx, socket-io-middleware.ts, and interceptors.ts to `TherrMobile/main/config/brandConfig.ts`; created `FeatureFlagContext.tsx` with Provider and `useFeatureFlags` hook)
  - [x] Integrate FeatureFlagProvider into TherrMobile App root (wrapped app in App.tsx, initialization before Layout renders)
  - [x] Add feature flag support to route configuration and navigation filtering (extended `ExtendedRouteOptions` in routes/index.tsx with `requiredFeatures` array; updated Layout.tsx route filtering to hide routes when required features are disabled)
  - [x] Create FeatureGate component and update MainButtonMenu (built `<FeatureGate feature={...}>` component for conditional UI rendering with AND/OR logic; updated MainButtonMenu.tsx to hide/show nav buttons based on flags with dynamic width calculation)
  - [ ] Define HABITS-specific feature flag configuration (disable: Map, Location, Moments, Spaces, Events, generic social feed; enable: Pacts, Invites, Streaks, Consequences, Proof uploads, mandatory invite flow)
  - [ ] Add AsyncStorage persistence for runtime flag overrides (implement flag override storage for A/B testing per Phase 5 requirements; create merge logic in FeatureFlagProvider to combine defaults with overrides)
  - [ ] Add premium feature flags for HABITS monetization (define `PREMIUM_VIDEO_PROOF`, `PREMIUM_ANALYTICS`, `PREMIUM_CUSTOM_CONSEQUENCES`, `PREMIUM_HEALTH_INTEGRATIONS`, `PREMIUM_UNLIMITED_PACTS`; integrate with user subscription status from Redux)
  - [ ] Add feature flag developer tools for debug mode (create dev-only Settings screen or modal to toggle flags at runtime when `__DEV__` is true; persist overrides to AsyncStorage for testing)
- [ ] Document existing Therr features to repurpose
  - [ ] Document User Authentication & Profiles repurposing (review `users-service/src/handlers/auth.ts`, `users-service/src/handlers/users.ts`, `TherrMobile/main/routes/Login/`, `TherrMobile/main/routes/Register/`; document OAuth flows, profile fields, JWT handling; identify fields to hide/disable for HABITS; deliverable: add HABITS_AUTH_REPURPOSING.md to docs/)
  - [ ] Document Social Connections repurposing for Pacts (review `users-service/src/handlers/userConnections.ts`, `UserConnectionsStore.ts`, `TherrMobile/main/routes/Connect/`, `TherrMobile/main/routes/Invite/`; document connection request flow, database schema; propose `pacts` table schema extending connections; deliverable: add HABITS_PACTS_SCHEMA.md to docs/)
  - [ ] Document Rewards/Points system repurposing for Streaks (review `users-service/src/handlers/rewards.ts`, `userAchievements.ts`, `therr-js-utilities/constants/achievements`; document TherrCoin/AchievementTier mechanics; propose streak-based achievements; deliverable: add HABITS_STREAKS_DESIGN.md to docs/)
  - [ ] Document Check-in mechanism repurposing for Habit Check-ins (review `maps-service/src/handlers/moments.ts`, `MomentsStore.ts`, `reactions-service/src/handlers/momentReactions.ts`; document moments schema and media handling; propose `habit_checkins` table removing geo requirements; deliverable: add HABITS_CHECKINS_DESIGN.md to docs/)
  - [ ] Document Push Notifications repurposing for Habit Reminders (review `push-notifications-service/src/handlers/`, `TherrMobile/main/utilities/pushNotifications.ts`, `therr-js-utilities/constants/enums/PushNotifications.ts`; document FCM setup and notification types; propose habit-specific notification types; deliverable: add HABITS_NOTIFICATIONS_DESIGN.md to docs/) — **engagement-feature priority order covered in `docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`; habit apps get the largest lift from soft opt-in, send-time personalization, and streak-aware copy**
  - [ ] Document Real-time Updates repurposing for Pact Activity Feed (review `websocket-service/src/handlers/`, `TherrMobile/main/socket-io-middleware.ts`, `TherrMobile/main/routes/Activities/`; document Socket.IO rooms and events; propose pact-specific real-time events; deliverable: add HABITS_REALTIME_DESIGN.md to docs/)
  - [ ] Document Media Upload repurposing for Proof Uploads (review `maps-service/src/handlers/helpers/createMediaUrls.ts`, `MediaStore.ts`, AWS S3 integration; document signed URL flow and media types; propose proof upload requirements; deliverable: add HABITS_MEDIA_DESIGN.md to docs/)
  - [ ] Document Groups repurposing for Pact Management (review `users-service/src/handlers/userGroups.ts`, `UserGroupsStore.ts`, `TherrMobile/main/routes/Groups/`; document group roles, membership, and notifications; propose pact-specific adaptations; deliverable: add HABITS_GROUPS_DESIGN.md to docs/)
- [ ] Consider viability and value of implementing React Native Paper to accelerate UI development and maintenance

**Deliverable:** Clean, documented codebase ready for new features

---

### Phase 2: Core Pact Features — IN PROGRESS
**Goal:** Build minimum viable product

- [ ] Streamline user authentication & onboarding
- [ ] Build "Create Pact" flow with **mandatory invite**
- [ ] Implement daily check-in mechanism
- [ ] Add photo/note proof upload
- [ ] Create pact activity feed
- [ ] Build push notification system for partner activity
- [ ] Add basic streak tracking

**Deliverable:** Two users can create pacts, invite each other, check in daily, see partner activity

---

### Phase 3: Viral Mechanics — PENDING
**Goal:** Build growth engine into the product

- [ ] Referral invite system (cannot be skipped)
- [ ] Shareable pact templates with unique links
- [ ] Social proof elements (success stories, leaderboard)
- [ ] "Challenge a Friend" with pre-filled invites
- [ ] Weekly email summaries with share buttons
- [ ] Friend activity notifications to create FOMO
- [ ] Public pact directory (opt-in)

**Deliverable:** Every user action encourages friend invites

---

### Phase 4: Monetization — PENDING
**Goal:** Implement freemium model and revenue generation

- [ ] Freemium paywall (1 pact free, unlimited premium)
- [ ] In-app purchase flows (iOS & Android)
- [ ] Premium analytics dashboard
- [ ] Video proof uploads (premium feature)
- [ ] Custom consequences builder
- [ ] Apple Health / Google Fit integration
- [ ] Subscription management

**Deliverable:** Revenue-generating premium tier

---

### Phase 5: Polish & Testing — PENDING
**Goal:** Optimize user experience and prepare for launch

- [ ] Optimize onboarding flow (reduce friction)
- [ ] A/B test invite messaging
- [ ] Bug fixes and performance optimization
- [ ] Create app store assets (screenshots, video, description)
- [ ] Beta testing with 50-100 users
- [ ] Gather feedback and iterate

**Deliverable:** Polished app ready for public launch

---

### Phase 6: Launch — PENDING
**Goal:** Get first 500-1,000 users organically

- [ ] Submit to App Store & Google Play Store
- [ ] Product Hunt launch
- [ ] Post in Reddit communities (r/productivity, r/fitness, r/habittracking)
- [ ] Reach out to micro-influencers in fitness/productivity
- [ ] Personal network outreach
- [ ] Monitor metrics and iterate

**Deliverable:** 500-1,000 users with viral loop active

---

## REVENUE MODEL & PROJECTIONS

### Monetization Strategy
**Primary:** Freemium subscription ($6.99/month)
**Secondary (Year 2+):** Corporate wellness, white-label, affiliate partnerships

### Conservative Growth Projections
- **Month 3:** 500 users (Product Hunt + initial network)
- **Month 6:** 5,000 users (viral coefficient 1.3x)
- **Month 9:** 20,000 users
- **Month 12:** 50,000 users

### Revenue Projections (Month 12)
- **Users:** 50,000
- **Premium Conversion:** 15% (industry standard: 10-30%)
- **Premium Subscribers:** 7,500
- **Monthly Price:** $6.99
- **Monthly Recurring Revenue:** **$52,425**
- **Annual Revenue:** **$629,100**

### Year 2 Revenue Streams
- Corporate wellness: $99-199/month per company
- White-label versions: $500-2,000/month per org
- In-app purchases: $5,000-10,000/month
- Affiliate partnerships: Commission-based
- **Potential Year 2 Revenue:** $750K - $1M+

---

## SUCCESS METRICS

### Development Phase (Weeks 1-8)
- Code deployment velocity
- Feature completion rate
- Beta user engagement (DAU/MAU ratio)
- Invite acceptance rate
- Pact completion rate

### Launch Phase (Weeks 9-12)
- Daily Active Users (DAU)
- **Viral coefficient (invites per user) - TARGET: >1.0**
- Pact completion rate (should be >70%)
- Premium conversion rate
- Day 1, 7, 30 retention rates

### Growth Phase (Months 3-12)
- Monthly user growth rate
- **Customer Acquisition Cost (should be near $0)**
- Lifetime Value (LTV)
- Churn rate (<5% monthly target)
- Revenue growth month-over-month

---

## CRITICAL SUCCESS FACTORS

### What Makes This Different from Therr Social
| Therr Social (Failed) | Friends With Habits (Will Succeed) |
|---|---|
| Need critical mass first | Works with 2 people |
| Competes with Instagram/Facebook | No direct competitor |
| Users can use alone | MUST invite friend |
| Hard to monetize (ads) | Clear premium value |
| Marketing intensive | Self-perpetuating |
| Ghost town problem | Small groups thrive |

### Non-Negotiable Design Principles
1. **Mandatory Invites:** Users CANNOT create pacts without inviting friends
2. **Simple First:** Start with core habit tracking, add complexity later
3. **Social Proof:** Show success stories, leaderboards, community wins
4. **Friction Reduction:** Make inviting friends as easy as possible
5. **Premium Value:** Free tier must work well, premium must be compelling

---

## RISK MITIGATION

### Risk 1: Users Don't Invite Friends
**Mitigation:** Make it literally impossible to use app without inviting at least 1 friend. Test messaging in beta to find what resonates.

### Risk 2: Low Premium Conversion
**Mitigation:** Start with generous free tier, introduce premium features users already want (unlimited pacts, video proof, analytics).

### Risk 3: Habit Completion Fatigue
**Mitigation:** Allow flexible pact terms (3x/week instead of daily), focus on small micro-habits, gamify with rewards.

### Risk 4: App Store Rejection
**Mitigation:** Ensure compliance with guidelines, no cash gambling in v1, clear terms of service, privacy policy.

### Risk 5: Technical Debt from Pivot
**Mitigation:** Weeks 1-2 dedicated to cleaning codebase, removing unused features, proper documentation.

---

## DEVELOPMENT PHILOSOPHY

### Working with Claude Code
- **Provide clear context:** Always reference this brief
- **Modular development:** Build features in isolated, testable components
- **Documentation first:** Document before coding
- **Feature flags:** Everything should be toggleable via config
- **Mobile-first:** Design for smallest screens first
- **Performance:** Keep app fast and responsive

### Code Quality Standards
- Follow React Native best practices
- Write self-documenting code with clear variable names
- Add comments for complex logic
- Test on both iOS and Android regularly
- Keep dependencies minimal and up-to-date
- Use TypeScript where possible

---

## NEXT STEPS FOR CLAUDE CODE SESSIONS

When starting development work with Claude Code, reference this brief and:

1. **Immediate:** Rebase `niche/HABITS-general` branch from `general` to pull in all revitalization work
2. **Phase 2:** Build core pact creation and check-in features
3. **Phase 3:** Implement viral referral mechanics (mandatory invite flow)
4. **Phase 4:** Add premium features and payment processing ($6.99/mo)
5. **Phase 5:** Polish UI/UX and optimize onboarding
6. **Phase 6:** Submit to App Store (iOS developer account needed) and update Google Play listing

---

## QUESTIONS TO ASK CLAUDE CODE

When working with Claude Code on this project, always start sessions by asking:

- "Have you reviewed the 'Friends With Habits' project brief?"
- "What phase are we currently in?"
- "What are the specific tasks for this phase?"
- "How does this feature fit into the viral growth strategy?"
- "Will this work on both iOS and Android?"
- "Does this follow our mobile-first, performance-focused approach?"

---

## KEY MANTRAS

**Remember These Always:**

1. **"No pact without a partner"** - Social accountability is mandatory
2. **"Every feature should encourage sharing"** - Viral growth is built-in
3. **"Ship fast, iterate faster"** - 8-12 weeks to launch
4. **"Free tier works, premium tier delights"** - Clear value distinction
5. **"Growth > perfection"** - Get to market, learn, improve

---

## FINAL NOTES

This project represents a strategic pivot from a failed location-based social app to a viral habit tracker with proven market demand. Success depends on:

- **Ruthless focus** on accountability mechanic
- **Mandatory social** features (not optional)
- **Rapid development** with Claude Code
- **Zero marketing spend** through viral mechanics
- **Clear monetization** via freemium subscriptions

The technology is 60% built. The market is proven. The viral mechanic is sound. Now it's about execution.

**Timeline:** Active development on `niche/HABITS-general` branch (April 2026 onwards). Branch will be rebased from `general` before continuing feature work.

---

**Document Version:** 2.0  
**Status:** Active Development — Primary Consumer Focus  
**Next Action:** Rebase `niche/HABITS-general` branch, then continue Phase 2 (Core Pact Features)
