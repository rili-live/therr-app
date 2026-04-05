# HABITS Savings Goals Design

## Executive Summary

Savings Goals are a **group-oriented pact type** where friends collectively save money toward a shared experience or purchase — a vacation, concert, group gift, or big event. Unlike habit pacts (which pair 1:1 for accountability), Savings Goal pacts can include entire friend groups (3–12 people) and have a concrete financial endpoint.

This feature is the **highest-virality mechanic in the app**. When someone creates a "Cancun trip" savings pact, every friend going on that trip must join. One pact creation can generate 5–10 new installs instantly, compared to 1 install per standard habit pact.

**Reuse Level**: 60% — Extends existing `habits.pacts` and `habits.habit_checkins` tables with a new `savings_goals` table and contribution tracking.

---

## Why This Has High Viral Potential

| Standard Habit Pact | Savings Goal Pact |
|---|---|
| 1 invite per pact | 3–12 invites per pact |
| Accountability motivation | Money + experience motivation |
| "Keep me honest" sharing | "Come to Vegas with us!" sharing |
| Progress is private/pair | Milestone posts are highly shareable |
| Vague end state | Clear, exciting finish line (vacation, concert) |
| Works with 2 people | Scales with group; more = cheaper per person |

The key insight: **inviting more people to a group trip lowers each person's cost**, so there is a built-in monetary incentive to invite more friends. This is fundamentally different from any existing habit tracker and most savings apps.

---

## Feature Overview

### Savings Goal Types

```typescript
enum SavingsGoalCategory {
  GROUP_TRIP     = 'group_trip',    // Vacation, weekend getaway
  GROUP_EVENT    = 'group_event',   // Concert, sporting event, festival
  GROUP_GIFT     = 'group_gift',    // Birthday, wedding, baby shower
  BIG_PURCHASE   = 'big_purchase',  // Shared item (gaming console, etc.)
  EMERGENCY_FUND = 'emergency_fund', // Group financial safety net
  CUSTOM         = 'custom',        // User-defined goal
}
```

### User-Facing Flow

```
1. Creator taps "New Goal" → selects category (trip, event, gift, purchase)
2. Names the goal ("Cancun 2026"), sets target amount ($3,000 total)
3. Sets target date (optional but recommended)
4. Adds a cover photo (beach, concert venue, etc.)
5. App calculates suggested per-person contribution based on group size and timeline
6. Invites friends — each invite sent = "Join our [Cancun] savings goal!"
7. Friends accept → each commits a weekly/monthly contribution amount
8. Everyone gets a progress dashboard: group total vs. goal, who has contributed, timeline
9. Each periodic check-in = confirming you made your savings deposit (photo/note proof)
10. When 100% reached → celebration screen, shareable "We did it!" card
```

### Invitation Shareable

When a user invites friends to a Savings Goal, the invite preview shows:
- Goal name and emoji/category icon
- Cover photo (user-uploaded or stock)
- Target amount and date
- "Join {Creator Name}'s savings goal — X friends are already in"
- "Your share would be ~${amount}/month"

This invite is compelling because it answers "why should I join this app?" immediately.

---

## Database Schema

### New Table: `habits.savings_goals`

```sql
CREATE TABLE habits.savings_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pact_id         UUID NOT NULL REFERENCES habits.pacts(id) ON DELETE CASCADE,
    category        VARCHAR(50) NOT NULL DEFAULT 'custom',  -- SavingsGoalCategory enum
    goal_name       VARCHAR(120) NOT NULL,
    description     TEXT,
    cover_image_url TEXT,
    target_amount   DECIMAL(12, 2) NOT NULL,              -- Total goal amount in USD
    current_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Cached running total
    target_date     DATE,                                   -- Optional deadline
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    is_completed    BOOLEAN NOT NULL DEFAULT false,
    completed_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_goals_pact_id ON habits.savings_goals(pact_id);
```

### New Table: `habits.savings_contributions`

```sql
CREATE TABLE habits.savings_contributions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    savings_goal_id     UUID NOT NULL REFERENCES habits.savings_goals(id) ON DELETE CASCADE,
    pact_member_id      UUID NOT NULL REFERENCES habits.pact_members(id),
    user_id             UUID NOT NULL,
    amount              DECIMAL(12, 2) NOT NULL,            -- Amount deposited this contribution
    contribution_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    proof_image_url     TEXT,                               -- Photo of bank transfer, receipt, etc.
    is_verified         BOOLEAN NOT NULL DEFAULT false,     -- Future: partner-verified
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_contributions_goal_id ON habits.savings_contributions(savings_goal_id);
CREATE INDEX idx_savings_contributions_user_id ON habits.savings_contributions(user_id);
```

### Pact Type Extension

The existing `habits.pacts` table has a `pactType` field. Add `savings` as a valid value:

```typescript
// Extends existing IPact.pactType
type PactType = 'accountability' | 'challenge' | 'support' | 'savings';
```

When `pactType = 'savings'`, the pact's check-in mechanism becomes a savings contribution
instead of a habit completion.

### Member Commitment Table Extension

Add optional commitment fields to `habits.pact_members` via migration:

```sql
ALTER TABLE habits.pact_members
    ADD COLUMN savings_commitment_amount   DECIMAL(12, 2),   -- Agreed periodic contribution
    ADD COLUMN savings_commitment_frequency VARCHAR(20);      -- 'weekly' | 'biweekly' | 'monthly'
```

---

## TypeScript Types

```typescript
// therr-public-library/therr-react/src/types/redux/habits.ts additions

export enum SavingsGoalCategory {
    GROUP_TRIP     = 'group_trip',
    GROUP_EVENT    = 'group_event',
    GROUP_GIFT     = 'group_gift',
    BIG_PURCHASE   = 'big_purchase',
    EMERGENCY_FUND = 'emergency_fund',
    CUSTOM         = 'custom',
}

export interface ISavingsGoal {
    id: string;
    pactId: string;
    category: SavingsGoalCategory;
    goalName: string;
    description?: string;
    coverImageUrl?: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;       // ISO date string
    currency: string;
    isCompleted: boolean;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    // Computed/joined fields
    memberCommitments?: IMemberCommitment[];
    contributions?: ISavingsContribution[];
    progressPercent?: number;  // currentAmount / targetAmount * 100
    daysRemaining?: number;
    projectedCompletion?: string;  // ISO date string, based on current pace
}

export interface ISavingsContribution {
    id: string;
    savingsGoalId: string;
    pactMemberId: string;
    userId: string;
    amount: number;
    contributionDate: string;   // ISO date string
    notes?: string;
    proofImageUrl?: string;
    isVerified: boolean;
    createdAt: string;
    // Joined
    userName?: string;
    userMedia?: string;
}

export interface IMemberCommitment {
    userId: string;
    pactMemberId: string;
    savingsCommitmentAmount: number;
    savingsCommitmentFrequency: 'weekly' | 'biweekly' | 'monthly';
    totalContributed: number;    // Computed from contributions
    contributionCount: number;
}
```

---

## API Endpoints

All endpoints under `/users-service/habits/savings` (extends existing habits router):

```
POST   /habits/savings/goals              Create savings goal (creates savings pact + goal)
GET    /habits/savings/goals              Get all user's savings goals (with pact info)
GET    /habits/savings/goals/:goalId      Get goal detail with contributions and members
PUT    /habits/savings/goals/:goalId      Update goal (name, date, amount, cover image)

POST   /habits/savings/goals/:goalId/invite         Invite member to savings goal
POST   /habits/savings/goals/:goalId/contributions  Add a savings contribution (check-in)
GET    /habits/savings/goals/:goalId/contributions  Get all contributions for a goal

GET    /habits/savings/goals/:goalId/summary        Get shareable summary (for social sharing)
```

### Example: Create Savings Goal

```typescript
// POST /habits/savings/goals
interface CreateSavingsGoalRequest {
    category: SavingsGoalCategory;
    goalName: string;
    description?: string;
    targetAmount: number;
    targetDate?: string;
    currency?: string;
    // Initial members can be invited at creation time
    initialInvites?: Array<{
        email?: string;
        userId?: string;
        commitmentAmount?: number;
        commitmentFrequency?: 'weekly' | 'biweekly' | 'monthly';
    }>;
}
```

---

## Redux Actions (additions to HabitsActionTypes)

```typescript
// New action types
GET_SAVINGS_GOALS            = 'GET_SAVINGS_GOALS',
GET_SAVINGS_GOAL_DETAILS     = 'GET_SAVINGS_GOAL_DETAILS',
CREATE_SAVINGS_GOAL          = 'CREATE_SAVINGS_GOAL',
UPDATE_SAVINGS_GOAL          = 'UPDATE_SAVINGS_GOAL',
ADD_SAVINGS_CONTRIBUTION     = 'ADD_SAVINGS_CONTRIBUTION',
GET_SAVINGS_CONTRIBUTIONS    = 'GET_SAVINGS_CONTRIBUTIONS',
INVITE_TO_SAVINGS_GOAL       = 'INVITE_TO_SAVINGS_GOAL',
SAVINGS_GOAL_COMPLETED       = 'SAVINGS_GOAL_COMPLETED',
```

---

## Mobile Screens

### Screen 1: Create Savings Goal (`routes/Savings/CreateSavingsGoal.tsx`)

Step-by-step wizard:
1. **Category Selector** — large icon grid (Trip, Event, Gift, Purchase, Custom)
2. **Goal Details** — name, optional description, cover photo upload
3. **Financial Target** — total amount, target date, timeline visualization
4. **Invite Friends** — contact picker + app share; shows estimated per-person cost
5. **Confirm** — summary card with "Create Goal" CTA

The per-person cost calculator updates live as invites are added:
```
"With 4 friends saving $200/month each, you'll reach $3,000 in just 4 months!"
```

### Screen 2: Savings Goal Dashboard (`routes/Savings/SavingsDashboard.tsx`)

- **Progress Ring** — large, animated, shows % complete
- **Group Total** — `$1,450 of $3,000` with currency
- **Days Remaining** — countdown if target date set
- **Projected Completion** — based on average contribution pace
- **Member Contributions List** — avatars with individual progress bars
- **Recent Activity Feed** — "Alex saved $50 yesterday 🎉"
- **Add Contribution** button (prominent CTA)

### Screen 3: Add Contribution (`routes/Savings/AddContribution.tsx`)

- Amount input
- Date (defaults to today)
- Optional note
- Optional proof photo (bank transfer screenshot, etc.)
- Running total shown after submission

### Screen 4: Goal Celebration (`routes/Savings/GoalCelebration.tsx`)

Triggered when `currentAmount >= targetAmount`:
- Full-screen confetti animation
- "You did it! 🎉 {Goal Name} goal reached!"
- Shareable card showing the group that saved together
- CTA: "Share with friends" (social sharing)
- "Plan your next goal" CTA

---

## Notification Types

New notification events for savings goals (add to `PushNotifications` enum):

```typescript
// New notification types
SAVINGS_CONTRIBUTION_ADDED   // "Alex added $100 to your Cancun fund!"
SAVINGS_GOAL_REMINDER        // "Don't forget your weekly savings contribution!"
SAVINGS_MILESTONE_REACHED    // "You're halfway to Cancun! 50% funded 🌴"
SAVINGS_GOAL_COMPLETED       // "Goal reached! Time to book that trip! ✈️"
SAVINGS_MEMBER_JOINED        // "Jordan just joined your Cancun savings group!"
SAVINGS_MEMBER_BEHIND        // "A friend hasn't contributed this week — check in on them"
```

Milestone notifications fire at: 25%, 50%, 75%, 90%, 100%.

---

## Virality Mechanics

### 1. Cost-Splitting Incentive
When inviting friends, the app shows:
```
"Current cost: $300/month
 Invite 2 more friends → $150/month each
 Invite 5 more friends → $75/month each"
```
Users are intrinsically motivated to invite more people.

### 2. Shareable Milestone Cards
At 25%, 50%, 75%, 100% — auto-generate a shareable card:
- Goal name + emoji
- Progress bar visual
- Group member count
- "Join us! We're saving for [Cancun] on Friends With Habits"

### 3. Goal Page (Public Opt-In)
Goals can have a public URL: `friendswithhabits.app/goals/cancun-2026-abc123`
- Shows group progress, member avatars, goal image
- Non-members see "Request to join" button
- Creates organic discovery outside the app

### 4. Event-Driven Invites
After creating a goal with a category (e.g., `GROUP_TRIP`), the app suggests:
```
"Who else is coming on this trip?
 Add more friends to split the cost"
```
This prompts a second wave of invites beyond the initial pact.

---

## Monetization Tie-In

### Free Tier
- 1 active savings goal at a time
- Up to 6 members per goal
- Basic progress tracking
- Manual contribution logging
- Photo proof (optional)

### Premium Tier ($6.99/month)
- Unlimited active savings goals
- Unlimited members per goal
- **Recurring contribution reminders** (automated nudges)
- **Bank integration (Plaid)** — auto-track deposits from connected account
- **Contribution analysis** — "At current pace, you'll reach your goal 3 weeks late"
- **Goal calculator** — "To reach $3,000 by July, each of 4 members needs $250/month"
- Priority goal page URL (custom slug)
- Export contribution history (CSV)

### Future Revenue (Year 2)
- **Trip booking affiliate commission** — When a goal is completed, offer booking links (Airbnb, Expedia, etc.) with affiliate codes. Goal completion is a high-intent buying moment.
- **Financial product referrals** — HYSA (high-yield savings account) recommendations for users who want to optimize their savings.

---

## Implementation Checklist

### Phase 1: Database & API (Backend)
- [ ] Write migration: `habits.savings_goals` table
- [ ] Write migration: `habits.savings_contributions` table
- [ ] Write migration: alter `habits.pact_members` with commitment fields
- [ ] Create `SavingsGoalsStore.ts`
- [ ] Create `SavingsContributionsStore.ts`
- [ ] Create `savingsGoalsRouter.ts` with all endpoints
- [ ] Register new router in `users-service/src/routes/index.ts`
- [ ] Add savings notification types to `PushNotifications` enum

### Phase 2: Redux & API Layer
- [ ] Add `ISavingsGoal`, `ISavingsContribution`, `IMemberCommitment` types to `habits.ts`
- [ ] Add savings action types to `HabitsActionTypes`
- [ ] Add savings reducer slice to `habits.ts` reducer
- [ ] Create `SavingsActions.ts` API action creators
- [ ] Register savings API calls in `therr-react` API service

### Phase 3: Mobile UI
- [ ] Create `routes/Savings/CreateSavingsGoal.tsx` (wizard)
- [ ] Create `routes/Savings/SavingsDashboard.tsx`
- [ ] Create `routes/Savings/AddContribution.tsx`
- [ ] Create `routes/Savings/GoalCelebration.tsx`
- [ ] Create `components/Savings/GoalProgressRing.tsx`
- [ ] Create `components/Savings/MemberContributionCard.tsx`
- [ ] Create `components/Savings/ShareableMilestoneCard.tsx`
- [ ] Add savings routes to `TherrMobile/main/routes/index.tsx`
- [ ] Add savings tab/section to `HabitsButtonMenu.tsx` (or navigation)
- [ ] Add cost-split calculator utility

### Phase 4: Notifications & Virality
- [ ] Implement savings contribution notification handler
- [ ] Implement milestone notification triggers (25/50/75/90/100%)
- [ ] Implement weekly reminder scheduler for contributions
- [ ] Build shareable milestone card image generation
- [ ] Create public goal page (React web client, SSR)
- [ ] Implement invite deep-link with cost preview

### Phase 5: Premium Features (Monetization Phase)
- [ ] Plaid bank integration (read-only transaction matching)
- [ ] Contribution pace analysis and projections
- [ ] Goal calculator tool
- [ ] CSV export
- [ ] Custom goal page URL slug

---

## Priority in Roadmap

**Recommended Insertion Point: Phase 3 (Viral Mechanics)**

This feature should be introduced during the viral mechanics phase because:
1. The check-in and pact infrastructure must be stable first (Phase 2)
2. It IS a viral mechanic — not a core pact feature
3. It requires no new infrastructure concepts (reuses pacts + check-ins)
4. It can launch as an MVP with just the basic flow (no Plaid, no public pages)

**MVP Scope for Phase 3:**
- Create savings goal (wizard)
- Invite members
- Log contributions manually
- View progress dashboard
- 100% celebration screen + share prompt

Full notification system and public pages can follow in Phase 4-5.

---

## Locale Keys Required

Add to all 3 mobile locale files (`en-us`, `es`, `fr-ca`):

```json
"pages.savings": {
    "headerTitle": "Savings Goals",
    "createGoal": "Create a Goal",
    "goalProgress": "Goal Progress",
    "totalSaved": "Total Saved",
    "yourContribution": "Your Contribution",
    "addContribution": "Add Contribution",
    "inviteMembers": "Invite Members",
    "costPerPerson": "~${amount}/month per person",
    "inviteToSave": "Invite more to lower the cost",
    "congratulations": "Goal Reached! 🎉",
    "shareGoal": "Share with Friends",
    "categories": {
        "group_trip": "Group Trip",
        "group_event": "Group Event",
        "group_gift": "Group Gift",
        "big_purchase": "Big Purchase",
        "emergency_fund": "Emergency Fund",
        "custom": "Custom Goal"
    },
    "milestones": {
        "quarter": "You're 25% of the way there!",
        "half": "Halfway there! Keep going!",
        "threeQuarter": "Almost there — 75% funded!",
        "almostDone": "So close! 90% funded!",
        "complete": "You did it! Goal reached!"
    }
}
```
