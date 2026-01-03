# Friends With Habits - PROJECT BRIEF & DEVELOPMENT CONTEXT

**Last Updated:** December 28, 2024  
**Project Status:** Pre-Development / Planning Complete  
**Developer:** Solo founder with full-time job and family commitments

---

## EXECUTIVE SUMMARY

**What We're Building:**  
'Therr: Friends With Habits' is an accountability-based habit tracker where users MUST invite friends to create "pacts" together. The mandatory social mechanic creates viral growth without marketing spend.

**Why This Project Exists:**  
This is a strategic pivot (or fork) of "Therr App" (a location-based social network that failed to gain traction). We're forking the source code and repurposing 60% of the existing infrastructure to enter a lower-competition market with built-in viral mechanics. Authorization will use the same API and database allowing users to authenticate to either app interchangbly. 'Therr: Friends With Habits' is an extension of the Therr, Inc. family of apps.

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

## 12-WEEK EXECUTION ROADMAP

### Phase 1: Foundation (Weeks 1-2, January 5-15) 
**Goal:** Prepare codebase for rapid AI-assisted development

- [x] Make mono repo fully Claude Code compatible
- [ ] Add regression tests to keep core app and sub-apps aligned
  - [x] Implement regression tests for main functionality of users-service
  - [x] Implement regression tests for main functionality of messages-service
  - [ ] Implement regression tests for main functionality of reactions-service
  - [ ] Implement regression tests for main functionality of push-notifications-service
  - [ ] Implement regression tests for main functionality of websocket-service
  - [ ] Implement regression tests for main functionality of therr-api-gateway-service
  - [ ] Implement regression tests for main functionality of TherrMobile React Native codebase
    - [x] Authentication system (login, register, OAuth with Google/Apple, session management)
    - [ ] Map & geolocation (location permissions, GPS tracking, content discovery, area search)
    - [ ] Content creation (moments/events/spaces/thoughts, image capture/upload, location tagging)
    - [x] Direct messaging & WebSocket communication (real-time messages, pagination, connection state)
    - [ ] Groups & forums (forum creation, message posting, member management, categories)
    - [x] User profile & settings (profile editing, password change, notification/privacy preferences)
    - [x] Push notifications (FCM setup, foreground/background handling, scheduled notifications)
    - [ ] Content feeds & carousels (discoveries, events, bookmarks, reactions, pagination)
    - [x] User connections (user search, connection requests, blocking, people you may know)
    - [ ] Navigation & route access control (authenticated vs public routes, email verification gates)
- [ ] Set up modular feature flag system for TherrMobile (utilizing TherrMobile/env-config.js)
- [ ] Upgrade dependencies to latest stable versions
- [ ] Document existing Therr features to repurpose
- [ ] Consider viability and value of implementing React Native Paper to accelerate UI development and maintenance

**Deliverable:** Clean, documented codebase ready for new features

---

### Phase 2: Core Pact Features (Weeks 3-4, January 19-29)
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

### Phase 3: Viral Mechanics (Weeks 5-6, February 2-12)
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

### Phase 4: Monetization (Weeks 7-8, February 16-27)
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

### Phase 5: Polish & Testing (Weeks 9-10, March 2-13)
**Goal:** Optimize user experience and prepare for launch

- [ ] Optimize onboarding flow (reduce friction)
- [ ] A/B test invite messaging
- [ ] Bug fixes and performance optimization
- [ ] Create app store assets (screenshots, video, description)
- [ ] Beta testing with 50-100 users
- [ ] Gather feedback and iterate

**Deliverable:** Polished app ready for public launch

---

### Phase 6: Launch (Weeks 11-12, March 16-27)
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

1. **Week 1-2:** Focus on making codebase Claude Code compatible
2. **Week 3-4:** Build core pact creation and check-in features
3. **Week 5-6:** Implement viral referral mechanics
4. **Week 7-8:** Add premium features and payment processing
5. **Week 9-10:** Polish UI/UX and optimize onboarding
6. **Week 11-12:** Prepare for launch and submit to app stores

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

**Timeline:** January 6, 2025 start → March 24, 2025 launch → June 2025 first revenue milestone

---

**Document Version:** 1.0  
**Status:** Ready for Development  
**Next Action:** Begin Week 1 - Foundation Phase

🚀 Let's build Friends w/ Habits!
