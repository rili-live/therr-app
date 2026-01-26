# HABITS Pacts Schema Design

## Executive Summary

Pacts are the core innovation of HABITS - mandatory accountability partnerships. They extend the existing `userConnections` table with habit-specific fields. The connection request flow is reusable; we add pact context (habit goal, duration, consequences) on top of the relationship.

**Reuse Level**: 70% - Extends connections with pact-specific fields and logic

---

## Current Implementation: User Connections

### Connection States

```typescript
enum UserConnectionTypes {
  MIGHT_KNOW = 'might-know',  // System-discovered potential match
  PENDING = 'pending',         // Awaiting acceptance
  COMPLETE = 'complete',       // Active connection
  DENIED = 'denied',           // Rejected request
  BLOCKED = 'blocked',         // User blocked
}
```

### Connection Types (Relationship Depth)

```typescript
// Integer field added in migration 20240510
1 = Stranger (default)
2 = Connection
3 = Friend
4 = Family
5 = Close Friend
```

### Connection Flow

```
User A sends request
    ↓
POST /users-service/users/connections
    ↓
Creates record: status='pending', requestingUserId=A, acceptingUserId=B
    ↓
Push notification sent to User B
    ↓
User B accepts
    ↓
PUT /users-service/users/connections
    ↓
Updates record: status='complete'
    ↓
Both users notified
```

---

## Database Schema: Current

### userConnections Table

```sql
CREATE TABLE main.userConnections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationship
    requestingUserId UUID NOT NULL REFERENCES users(id),
    acceptingUserId UUID NOT NULL REFERENCES users(id),

    -- Status
    requestStatus VARCHAR NOT NULL DEFAULT 'pending',
    type INTEGER DEFAULT 1,  -- 1-5 relationship type

    -- Engagement
    interactionCount INTEGER DEFAULT 1,

    -- Soft Delete
    isConnectionBroken BOOLEAN DEFAULT false,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(requestingUserId, acceptingUserId)
);

-- Indexes
CREATE INDEX idx_connections_status ON userConnections(requestStatus);
CREATE INDEX idx_connections_users ON userConnections(requestingUserId, acceptingUserId);
CREATE INDEX idx_connections_interaction ON userConnections(interactionCount);
```

### invites Table

```sql
CREATE TABLE main.invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requestingUserId UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255),
    phoneNumber VARCHAR(24),
    isAccepted BOOLEAN DEFAULT false,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(email),
    UNIQUE(phoneNumber)
);
```

---

## Key Files & Code Paths

### Backend (users-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/userConnections.ts` | Connection CRUD | `createUserConnection()`, `updateUserConnection()` |
| `src/store/UserConnectionsStore.ts` | Database queries | `createUserConnection()`, `getUserConnections()` |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/routes/Connect/index.tsx` | Connections screen (3 tabs) |
| `main/routes/Invite/index.tsx` | Invite flow |
| `main/routes/Invite/PhoneContacts.tsx` | Bulk invite from contacts |
| `main/routes/Invite/CreateConnection.tsx` | Single invite form |

### Shared Library (therr-react)

| File | Purpose |
|------|---------|
| `src/redux/actions/UserConnections.ts` | Connection Redux actions |
| `src/services/UserConnectionsService.ts` | API client |

---

## API Endpoints: Current

```
POST /users-service/users/connections
  Body: { acceptingUserId }
  Response: { connection }

POST /users-service/users/connections/create-or-invite
  Body: {
    userPhoneNumbers: string[],
    userEmails: string[],
    shouldCreateAutoConnections: boolean
  }
  Response: { userConnections, requestedUserIds }

PUT /users-service/users/connections
  Body: {
    otherUserId,
    requestStatus: 'complete' | 'denied' | 'blocked',
    interactionCount?,
    isConnectionBroken?
  }
  Response: { connection }

GET /users-service/users/connections
  Query: { filterBy?, orderBy?, limit?, offset? }
  Response: { connections[], pagination }

POST /users-service/users/connections/increment
  Body: { acceptingUserId, incrBy }
  Response: { connection }
```

---

## Repurposing for HABITS: Pacts

### Concept Mapping

| Therr Concept | HABITS Concept | Notes |
|---------------|----------------|-------|
| Connection | Pact Partner | Underlying relationship |
| Connection Request | Pact Invitation | With habit goal attached |
| `type` (1-5) | N/A | Remove or ignore |
| `interactionCount` | `engagementScore` | Track check-ins, messages |
| `isConnectionBroken` | `isPactEnded` | Pact completed or abandoned |

### Pact Lifecycle

```
User A creates habit goal
    ↓
User A invites User B to pact
    ↓
POST /users-service/pacts (new endpoint)
    ↓
Creates: pact record + connection (if not exists)
    ↓
Push notification: "A invited you to a habit pact!"
    ↓
User B accepts pact
    ↓
PUT /users-service/pacts/:id/accept
    ↓
Pact active, both users can check in
    ↓
Daily check-ins tracked
    ↓
Pact ends (completed, expired, or abandoned)
```

---

## New Schema: Pacts

### Option A: Extend userConnections (Recommended)

Add columns to existing table:

```sql
ALTER TABLE main.userConnections ADD COLUMN (
    -- Pact Context
    pactType VARCHAR(50),           -- 'accountability', 'challenge', 'support'
    pactStatus VARCHAR(50),         -- 'pending', 'active', 'completed', 'abandoned'
    habitGoalId UUID,               -- Reference to habit goal

    -- Pact Timeline
    pactStartDate TIMESTAMP,
    pactEndDate TIMESTAMP,
    pactDurationDays INTEGER,       -- 7, 14, 30, 90, etc.

    -- Consequences (Premium Feature)
    consequenceType VARCHAR(50),    -- 'none', 'donation', 'dare', 'custom'
    consequenceDetails JSONB,       -- { amount: 10, recipient: 'charity_id' }

    -- Engagement
    engagementScore INTEGER DEFAULT 0,
    lastInteractionAt TIMESTAMP,

    -- Completion
    endReason VARCHAR(100),         -- 'completed', 'expired', 'mutual_end', 'partner_left'
    completionPercentage DECIMAL(5,2)
);

-- New Indexes
CREATE INDEX idx_pacts_status ON userConnections(pactStatus) WHERE pactStatus IS NOT NULL;
CREATE INDEX idx_pacts_goal ON userConnections(habitGoalId) WHERE habitGoalId IS NOT NULL;
CREATE INDEX idx_pacts_dates ON userConnections(pactStartDate, pactEndDate);
```

### Option B: Separate pacts Table

```sql
CREATE TABLE habits.pacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Participants (references userConnections for relationship)
    connectionId UUID REFERENCES userConnections(id),
    creatorUserId UUID NOT NULL REFERENCES users(id),
    partnerUserId UUID NOT NULL REFERENCES users(id),

    -- Habit Goal
    habitGoalId UUID NOT NULL,  -- References habit_goals table

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Timeline
    startDate TIMESTAMP,
    endDate TIMESTAMP,
    durationDays INTEGER NOT NULL DEFAULT 30,

    -- Consequences
    consequenceType VARCHAR(50) DEFAULT 'none',
    consequenceDetails JSONB,

    -- Stats
    creatorCompletions INTEGER DEFAULT 0,
    partnerCompletions INTEGER DEFAULT 0,
    totalExpectedCompletions INTEGER,

    -- Completion
    endReason VARCHAR(100),
    winnerId UUID,  -- For challenges

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pacts_status ON habits.pacts(status);
CREATE INDEX idx_pacts_participants ON habits.pacts(creatorUserId, partnerUserId);
CREATE INDEX idx_pacts_goal ON habits.pacts(habitGoalId);
```

### Habit Goals Table (New)

```sql
CREATE TABLE habits.habit_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Goal Definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),           -- 'fitness', 'learning', 'health', etc.

    -- Frequency
    frequencyType VARCHAR(20) NOT NULL,  -- 'daily', 'weekly', 'custom'
    frequencyCount INTEGER DEFAULT 1,     -- X times per frequencyType
    targetDaysPerWeek INTEGER[],         -- [1,2,3,4,5] for weekdays

    -- Creator
    createdByUserId UUID NOT NULL REFERENCES users(id),
    isTemplate BOOLEAN DEFAULT false,     -- Reusable template

    -- Visibility
    isPublic BOOLEAN DEFAULT false,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_creator ON habits.habit_goals(createdByUserId);
CREATE INDEX idx_goals_category ON habits.habit_goals(category);
CREATE INDEX idx_goals_public ON habits.habit_goals(isPublic) WHERE isPublic = true;
```

---

## New API Endpoints

### Pact Management

```
POST /users-service/pacts
  Body: {
    partnerUserId: string,        // Or email/phone if not registered
    habitGoal: {
      name: string,
      description?: string,
      category: string,
      frequencyType: 'daily' | 'weekly',
      frequencyCount: number
    },
    durationDays: number,         // 7, 14, 30, 90
    consequenceType?: string,
    consequenceDetails?: object
  }
  Response: { pact, habitGoal }

GET /users-service/pacts
  Query: { status?, limit?, offset? }
  Response: { pacts[], pagination }

GET /users-service/pacts/:id
  Response: { pact, habitGoal, partner, stats }

PUT /users-service/pacts/:id/accept
  Response: { pact }

PUT /users-service/pacts/:id/decline
  Response: { pact }

PUT /users-service/pacts/:id/end
  Body: { reason: 'completed' | 'abandoned' | 'mutual' }
  Response: { pact }

GET /users-service/pacts/:id/stats
  Response: {
    creatorStats: { completions, streak, percentage },
    partnerStats: { completions, streak, percentage },
    totalDays, remainingDays
  }
```

### Habit Goal Templates

```
GET /users-service/habit-goals/templates
  Query: { category?, limit? }
  Response: { templates[] }

POST /users-service/habit-goals
  Body: { name, description, category, frequencyType, frequencyCount }
  Response: { habitGoal }
```

---

## Mobile Components: New

### Pact Creation Flow

```
CreatePactScreen
├── Step 1: Choose Habit
│   ├── Browse Templates
│   ├── Create Custom Habit
│   └── Recent Habits
├── Step 2: Set Parameters
│   ├── Duration Picker (7/14/30/90 days)
│   ├── Frequency Selector
│   └── Consequences (Premium)
├── Step 3: Invite Partner (MANDATORY)
│   ├── Search Existing Users
│   ├── Invite from Contacts
│   └── Share Invite Link
└── Step 4: Confirm & Send
```

### Pact Dashboard

```
PactDetailScreen
├── Header: Partner Avatar + Habit Name
├── Progress Ring (both users)
├── Stats Cards
│   ├── Your Streak
│   ├── Partner Streak
│   └── Days Remaining
├── Activity Feed (real-time)
├── Check-in Button
└── Actions
    ├── Message Partner
    ├── View Full History
    └── End Pact Early
```

---

## Invite Flow: Mandatory Social

The key innovation is making invites **mandatory**:

### Flow for New Users

```
Register → Email Verified → MUST Create First Pact
                                    ↓
                          Cannot skip this step
                                    ↓
                          "Invite a Friend" screen
                                    ↓
              Search / Import Contacts / Share Link
                                    ↓
                          Invitation Sent
                                    ↓
                    Wait for acceptance (or remind)
                                    ↓
                          Pact Active
                                    ↓
                          App Unlocked
```

### Enforcement Points

1. **Registration Complete Screen**
   - Do NOT navigate to main app
   - Show "Create Your First Pact" CTA

2. **Main Navigation Guard**
   - Check: Does user have at least 1 active pact?
   - If no: Redirect to pact creation
   - If yes: Allow access

3. **API Validation**
   - Habit check-ins require active pact
   - Return error if user has no pacts

---

## Implementation Checklist

### Phase 1: Database Schema
- [ ] Create migration for `habit_goals` table
- [ ] Create migration for pact fields on `userConnections` (or separate `pacts` table)
- [ ] Add indexes for pact queries
- [ ] Create seed data for habit goal templates

### Phase 2: Backend Handlers
- [ ] Create `src/handlers/pacts.ts`
- [ ] Create `src/handlers/habitGoals.ts`
- [ ] Create `src/store/PactsStore.ts`
- [ ] Create `src/store/HabitGoalsStore.ts`
- [ ] Add pact routes to router

### Phase 3: Shared Library
- [ ] Add `PactsService.ts` to therr-react
- [ ] Add `HabitGoalsService.ts` to therr-react
- [ ] Add Redux actions for pacts
- [ ] Add Redux reducer for pacts state

### Phase 4: Mobile Screens
- [ ] Create `CreatePact/` route with multi-step flow
- [ ] Create `PactDetail/` route
- [ ] Create `PactsList/` component
- [ ] Add mandatory pact check to navigation guard
- [ ] Update invite flow for pact context

### Phase 5: Notifications
- [ ] Add `PACT_INVITATION` notification type
- [ ] Add `PACT_ACCEPTED` notification type
- [ ] Add `PACT_PARTNER_CHECKED_IN` notification type
- [ ] Add `PACT_STREAK_WARNING` notification type

---

## Code Snippets

### Mandatory Pact Check (Navigation Guard)

```typescript
// TherrMobile/main/components/Layout.tsx
const checkHasPacts = async (userId: string): Promise<boolean> => {
  const response = await PactsService.getMyPacts({ status: 'active' });
  return response.data.pacts.length > 0;
};

const NavigationGuard = ({ children }) => {
  const { user } = useSelector(state => state.user);
  const [hasPacts, setHasPacts] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.id) {
      checkHasPacts(user.id).then(setHasPacts);
    }
  }, [user?.id]);

  if (hasPacts === false) {
    return <CreateFirstPactScreen />;
  }

  return children;
};
```

### Pact Creation Handler

```typescript
// therr-services/users-service/src/handlers/pacts.ts
const createPact = async (req, res) => {
  const { partnerUserId, habitGoal, durationDays, consequenceType } = req.body;
  const creatorUserId = req.user.id;

  // 1. Create or get habit goal
  const goal = await HabitGoalsStore.create({
    ...habitGoal,
    createdByUserId: creatorUserId,
  });

  // 2. Ensure connection exists
  let connection = await UserConnectionsStore.findByUsers(creatorUserId, partnerUserId);
  if (!connection) {
    connection = await UserConnectionsStore.create({
      requestingUserId: creatorUserId,
      acceptingUserId: partnerUserId,
      requestStatus: 'pending',
    });
  }

  // 3. Create pact
  const pact = await PactsStore.create({
    connectionId: connection.id,
    creatorUserId,
    partnerUserId,
    habitGoalId: goal.id,
    durationDays,
    consequenceType,
    status: 'pending',
  });

  // 4. Send notification
  await sendPactInvitation(partnerUserId, creatorUserId, pact, goal);

  return res.status(201).json({ pact, habitGoal: goal });
};
```

---

## Pact Status State Machine

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │ declined │   │  active  │   │ expired  │
      └──────────┘   └────┬─────┘   └──────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │completed │  │ abandoned│  │mutual_end│
      └──────────┘  └──────────┘  └──────────┘
```

---

## Premium Features (Future)

### Consequences System
- **Donation**: Auto-donate to charity if pact fails
- **Dare**: Partner assigns punishment task
- **Stakes**: Money held in escrow, winner takes all

### Public Pacts
- Shareable pact pages with progress
- Leaderboard integration
- Community challenges
