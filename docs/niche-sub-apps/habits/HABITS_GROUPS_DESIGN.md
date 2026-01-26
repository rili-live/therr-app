# HABITS Groups Design (Pact Management)

## Executive Summary

The Therr groups system manages multi-user forums with roles, membership status, and notifications. For HABITS, we simplify this for two-person "pacts" (accountability partnerships). The group infrastructure provides patterns for membership, roles, and notification preferences that adapt well to pact management.

**Reuse Level**: 60% - Patterns reusable, simplified for 2-person pacts

---

## Current Implementation

### What is a Group (Forum)?

A Group/Forum in Therr is a multi-user space for:
- Shared messaging
- Event creation within the group
- Member management with roles
- Notification preferences per member

### Group Membership Model

```typescript
interface IUserGroup {
  id: string;
  userId: string;
  groupId: string;
  role: GroupMemberRoles;
  status: GroupRequestStatuses;
  shouldMuteNotifs: boolean;
  shouldShareLocation: boolean;
  engagementCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Group Member Roles

```typescript
enum GroupMemberRoles {
  CREATOR = 'creator',
  ADMIN = 'admin',
  EVENT_HOST = 'event-host',
  MEMBER = 'member',
  READ_ONLY = 'read-only',
}
```

### Group Membership Statuses

```typescript
enum GroupRequestStatuses {
  PENDING = 'pending',    // Invitation sent
  APPROVED = 'approved',  // Active member
  REMOVED = 'denied',     // Left or removed
}
```

---

## Database Schema

### user_groups Table

```sql
CREATE TABLE main.user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupId UUID NOT NULL,  -- References forums table

    -- Membership
    role VARCHAR(50) DEFAULT 'member',
    status VARCHAR(50) DEFAULT 'pending',

    -- Preferences
    shouldMuteNotifs BOOLEAN DEFAULT false,
    shouldShareLocation BOOLEAN DEFAULT false,

    -- Engagement
    engagementCount INTEGER DEFAULT 0,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(userId, groupId)
);

CREATE INDEX idx_user_groups_user ON user_groups(userId);
CREATE INDEX idx_user_groups_group ON user_groups(groupId);
CREATE INDEX idx_user_groups_status ON user_groups(status);
```

---

## Key Files & Code Paths

### Backend (users-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/userGroups.ts` | Group membership | `getUserGroups()`, `createUserGroup()`, `updateUserGroup()` |
| `src/store/UserGroupsStore.ts` | Database queries | CRUD operations |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/routes/Groups/index.tsx` | Groups list screen |
| `main/routes/Groups/ViewGroup.tsx` | Group detail (3 tabs) |
| `main/routes/Groups/EditGroup.tsx` | Create/edit group |

---

## API Endpoints

### Group Membership

```
GET /users-service/users/groups
  Query: { shouldGetGroupDetails?: boolean }
  Response: { userGroups: IUserGroup[] }

GET /users-service/users/groups/:groupId/members
  Query: { limit?, offset? }
  Response: { members: [{ userGroup, user }] }

POST /users-service/users/groups
  Body: { groupId, role? }
  Response: { userGroup }

PUT /users-service/users/groups/:id
  Body: { role?, status?, shouldMuteNotifs? }
  Response: { userGroup }

DELETE /users-service/users/groups/:id
  Response: { success }

POST /users-service/users/groups/notify-members
  Body: { groupId, notificationType, data }
  Response: { sent: number }

GET /users-service/users/groups/:groupId/count
  Response: { count: number }
```

---

## Mobile Components

### Groups List Screen

```
GroupsListScreen
├── Search/Filter Bar
├── My Groups Section
│   └── GroupCard (for each joined group)
├── Discover Groups Section
│   └── GroupCard (for public groups)
└── Create Group FAB
```

### View Group Screen (3 Tabs)

```
ViewGroupScreen
├── Header: Group Name + Cover Image
├── Tab Bar
│   ├── CHAT Tab
│   │   └── Messages List (real-time)
│   ├── EVENTS Tab
│   │   └── Group Events (AreaDisplay cards)
│   └── MEMBERS Tab
│       └── Member List with Roles
└── Actions
    ├── Leave Group
    ├── Mute Notifications
    └── Invite Members
```

---

## Repurposing for HABITS: Pact Management

### Concept Mapping

| Groups Concept | Pacts Concept | Notes |
|----------------|---------------|-------|
| Group | Pact | Two-person accountability |
| GroupMemberRoles | PactRoles | Simplified: creator/partner |
| GroupRequestStatuses | PactStatuses | active/pending/ended |
| engagementCount | completionRate | Track check-ins |
| shouldMuteNotifs | Keep as-is | Notification preference |
| CHAT tab | Activity Feed | Real-time updates |
| EVENTS tab | N/A | Remove |
| MEMBERS tab | Partner View | Just 2 people |

### Simplifications for Pacts

| Groups (Multi-User) | Pacts (2-Person) |
|---------------------|------------------|
| Complex role hierarchy | Just creator + partner |
| Discovery/browsing | Direct invitation only |
| Public/private toggle | Always private |
| Multiple events | Single habit goal |
| General chat | Focused activity feed |

---

## New Schema: Pact Membership

### Option A: Reuse user_groups with Pact Context

```sql
-- Add pact-specific fields to user_groups
ALTER TABLE main.user_groups ADD COLUMN (
    -- Pact Context
    pactId UUID,                    -- Reference to pacts table
    habitGoalId UUID,

    -- Pact Stats
    totalCheckins INTEGER DEFAULT 0,
    currentStreak INTEGER DEFAULT 0,
    longestStreak INTEGER DEFAULT 0,
    completionPercentage DECIMAL(5,2),

    -- Pact Preferences
    dailyReminderTime TIME,
    weeklyReportEnabled BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_groups_pact ON user_groups(pactId) WHERE pactId IS NOT NULL;
```

### Option B: Separate pact_members Table (Recommended)

```sql
CREATE TABLE habits.pact_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    pactId UUID NOT NULL REFERENCES habits.pacts(id) ON DELETE CASCADE,
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role
    role VARCHAR(20) NOT NULL DEFAULT 'partner',  -- 'creator' or 'partner'

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    joinedAt TIMESTAMP,
    leftAt TIMESTAMP,

    -- Stats
    totalCheckins INTEGER DEFAULT 0,
    completedCheckins INTEGER DEFAULT 0,
    currentStreak INTEGER DEFAULT 0,
    longestStreak INTEGER DEFAULT 0,
    completionRate DECIMAL(5,2),

    -- Preferences
    shouldMuteNotifs BOOLEAN DEFAULT false,
    dailyReminderTime TIME,
    celebratePartnerCheckins BOOLEAN DEFAULT true,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(pactId, userId)
);

CREATE INDEX idx_pact_members_pact ON habits.pact_members(pactId);
CREATE INDEX idx_pact_members_user ON habits.pact_members(userId);
CREATE INDEX idx_pact_members_status ON habits.pact_members(status);
```

### Pact Member Roles

```typescript
enum PactMemberRoles {
  CREATOR = 'creator',   // Created the pact
  PARTNER = 'partner',   // Accepted the invitation
}
```

### Pact Member Statuses

```typescript
enum PactMemberStatuses {
  PENDING = 'pending',       // Invitation sent
  ACTIVE = 'active',         // Accepted, pact in progress
  COMPLETED = 'completed',   // Pact finished successfully
  LEFT = 'left',             // Member left early
  REMOVED = 'removed',       // Removed by creator
}
```

---

## New API Endpoints

### Pact Member Management

```
GET /habits-service/pacts/:pactId/members
  Response: {
    members: [{
      id, userId, role, status,
      user: { userName, media },
      stats: { totalCheckins, currentStreak, completionRate }
    }]
  }

GET /habits-service/pacts/:pactId/members/:userId
  Response: {
    member,
    recentCheckins: [],
    achievements: []
  }

PUT /habits-service/pacts/:pactId/members/:userId
  Body: {
    shouldMuteNotifs?,
    dailyReminderTime?,
    celebratePartnerCheckins?
  }
  Response: { member }

POST /habits-service/pacts/:pactId/members/:userId/leave
  Body: { reason?: string }
  Response: { success, pactStatus }
```

### Pact Stats

```
GET /habits-service/pacts/:pactId/stats
  Response: {
    pact: { id, habitGoal, startDate, endDate },
    creatorStats: {
      userId, userName,
      totalCheckins, completionRate, currentStreak
    },
    partnerStats: {
      userId, userName,
      totalCheckins, completionRate, currentStreak
    },
    comparison: {
      leader: 'creator' | 'partner' | 'tied',
      streakDifference: number
    }
  }

GET /habits-service/pacts/:pactId/leaderboard
  Response: {
    entries: [
      { rank: 1, userId, streak, completionRate },
      { rank: 2, userId, streak, completionRate }
    ]
  }
```

---

## Mobile Components: Pact Management

### Pact Detail Screen

```
PactDetailScreen
├── Header
│   ├── Habit Name
│   ├── Days Remaining Badge
│   └── Partner Avatar
├── Progress Section
│   ├── Your Progress Ring (completion %)
│   ├── Partner Progress Ring
│   └── Comparison Indicator
├── Stats Cards
│   ├── Your Streak
│   ├── Partner Streak
│   └── Days Completed
├── Activity Feed (real-time)
│   └── Check-ins, celebrations, milestones
├── Check-in Button
└── Actions Menu
    ├── Mute Notifications
    ├── Change Reminder Time
    ├── Message Partner
    └── End Pact Early
```

### Partner Comparison Widget

```typescript
// TherrMobile/main/components/PartnerComparison.tsx

const PartnerComparison = ({ pactId }) => {
  const stats = useSelector(state => state.pacts.stats[pactId]);

  if (!stats) return null;

  const { creatorStats, partnerStats, comparison } = stats;

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <UserAvatar userId={creatorStats.userId} />
        <ProgressRing percentage={creatorStats.completionRate} />
        <Text>{creatorStats.currentStreak} day streak</Text>
        {comparison.leader === 'creator' && <LeaderBadge />}
      </View>

      <View style={styles.vs}>
        <Text>vs</Text>
      </View>

      <View style={styles.side}>
        <UserAvatar userId={partnerStats.userId} />
        <ProgressRing percentage={partnerStats.completionRate} />
        <Text>{partnerStats.currentStreak} day streak</Text>
        {comparison.leader === 'partner' && <LeaderBadge />}
      </View>
    </View>
  );
};
```

### Pact Settings Screen

```typescript
// TherrMobile/main/routes/Pacts/PactSettings.tsx

const PactSettings = ({ pactId }) => {
  const [settings, setSettings] = useState({
    shouldMuteNotifs: false,
    dailyReminderTime: '09:00',
    celebratePartnerCheckins: true,
  });

  return (
    <ScrollView>
      <Section title="Notifications">
        <SettingsToggle
          label="Mute All Notifications"
          value={settings.shouldMuteNotifs}
          onChange={(v) => updateSetting('shouldMuteNotifs', v)}
        />

        <SettingsToggle
          label="Celebrate Partner Check-ins"
          description="Get notified when partner completes"
          value={settings.celebratePartnerCheckins}
          onChange={(v) => updateSetting('celebratePartnerCheckins', v)}
        />

        <TimePicker
          label="Daily Reminder"
          value={settings.dailyReminderTime}
          onChange={(v) => updateSetting('dailyReminderTime', v)}
        />
      </Section>

      <Section title="Pact Management">
        <Button
          title="Message Partner"
          onPress={() => navigation.navigate('DirectMessage', { partnerId })}
        />

        <Button
          title="End Pact Early"
          style={styles.dangerButton}
          onPress={confirmEndPact}
        />
      </Section>
    </ScrollView>
  );
};
```

---

## Pact Lifecycle Management

### Creation Flow

```
Creator starts "Create Pact"
    ↓
Selects/creates habit goal
    ↓
Sets duration (7, 14, 30, 90 days)
    ↓
Invites partner (MANDATORY)
    ↓
Creates pact record (status: 'pending')
    ↓
Creates pact_member for creator (role: 'creator', status: 'active')
    ↓
Creates pact_member for partner (role: 'partner', status: 'pending')
    ↓
Sends invitation (push + in-app)
    ↓
Partner accepts
    ↓
Updates partner pact_member (status: 'active')
    ↓
Updates pact (status: 'active', startDate: now)
    ↓
Both users can now check in
```

### Ending a Pact

```typescript
// habits-service/src/handlers/pacts.ts

const endPact = async (req, res) => {
  const { pactId } = req.params;
  const { reason } = req.body;  // 'completed' | 'abandoned' | 'mutual'
  const userId = req.user.id;

  const pact = await PactsStore.findById(pactId);

  // Calculate final stats
  const members = await PactMembersStore.findByPactId(pactId);
  const creatorMember = members.find(m => m.role === 'creator');
  const partnerMember = members.find(m => m.role === 'partner');

  // Determine winner (if challenge)
  let winnerId = null;
  if (creatorMember.completionRate > partnerMember.completionRate) {
    winnerId = creatorMember.userId;
  } else if (partnerMember.completionRate > creatorMember.completionRate) {
    winnerId = partnerMember.userId;
  }

  // Update pact
  await PactsStore.update(pactId, {
    status: reason === 'completed' ? 'completed' : 'ended',
    endReason: reason,
    endedAt: new Date(),
    winnerId,
  });

  // Update members
  for (const member of members) {
    await PactMembersStore.update(member.id, {
      status: reason === 'completed' ? 'completed' : 'left',
    });
  }

  // Award achievements
  if (reason === 'completed') {
    await awardPactCompletionAchievements(pact, members);
  }

  // Notify partner
  const partnerId = pact.creatorUserId === userId
    ? pact.partnerUserId
    : pact.creatorUserId;

  await sendPushNotification({
    userId: partnerId,
    type: PushNotifications.pactCompleted,
    data: {
      pactId,
      habitName: pact.habitGoal.name,
      reason,
    },
  });

  return res.json({ pact, members });
};
```

---

## Notification Integration

### Notify Pact Members

```typescript
// Adapts users-service/src/handlers/userGroups.ts notifyGroupMembers pattern

const notifyPactMembers = async (
  pactId: string,
  notificationType: PushNotifications,
  data: object,
  excludeUserId?: string
) => {
  const members = await PactMembersStore.findByPactId(pactId);

  for (const member of members) {
    // Skip sender
    if (member.userId === excludeUserId) continue;

    // Check mute preference
    if (member.shouldMuteNotifs) continue;

    // Check specific notification preferences
    if (notificationType === PushNotifications.partnerCheckedIn &&
        !member.celebratePartnerCheckins) continue;

    await sendPushNotification({
      userId: member.userId,
      type: notificationType,
      data,
    });
  }
};
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create `habits.pact_members` table migration
- [ ] Add PactMemberRoles enum
- [ ] Add PactMemberStatuses enum
- [ ] Add indexes for efficient queries

### Phase 2: Backend Store
- [ ] Create `PactMembersStore.ts`
- [ ] Implement CRUD operations
- [ ] Implement stats calculation queries
- [ ] Implement member preference updates

### Phase 3: Backend Handlers
- [ ] Create member endpoints in `pacts.ts`
- [ ] Implement `notifyPactMembers` helper
- [ ] Implement pact lifecycle (create, accept, end)
- [ ] Integrate with check-in for stat updates

### Phase 4: API Routes
- [ ] Add member routes
- [ ] Add stats routes
- [ ] Add preference update routes

### Phase 5: Mobile - Redux
- [ ] Add pact members to state
- [ ] Add stats to state
- [ ] Create actions for member updates

### Phase 6: Mobile - Screens
- [ ] Create `PactDetailScreen`
- [ ] Create `PartnerComparison` widget
- [ ] Create `PactSettings` screen
- [ ] Create `PactActivityFeed` component

### Phase 7: Mobile - Lifecycle
- [ ] Implement accept pact flow
- [ ] Implement end pact flow
- [ ] Add confirmation dialogs
- [ ] Handle partner notifications

---

## Differences from Groups

| Feature | Groups | Pacts |
|---------|--------|-------|
| Size | Unlimited members | Exactly 2 members |
| Discovery | Public browsable | Private invitation |
| Roles | 5 role types | 2 role types |
| Content | Messages + Events | Activity feed only |
| Duration | Indefinite | Time-bound (7-90 days) |
| Goal | General community | Single habit goal |
| Competition | None | Optional comparison |
| Completion | Never ends | Has end date |
