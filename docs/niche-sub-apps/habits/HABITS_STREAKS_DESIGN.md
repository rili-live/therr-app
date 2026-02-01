# HABITS Streaks Design

## Executive Summary

The Therr rewards system uses TherrCoin currency and tiered achievements. For HABITS, we repurpose this as a **streak-based achievement system** where consecutive habit completions unlock rewards. The existing achievement infrastructure (12 classes, tiered progression, point rewards) adapts well to streak milestones.

**Reuse Level**: 60% - Achievement framework reusable, need new streak calculation logic

---

## Current Implementation: Rewards & Achievements

### TherrCoin Currency

```typescript
// User balance stored in users table
settingsTherrCoinTotal: DECIMAL  // e.g., 125.50 coins

// Exchange rate calculation
exchangeRate = (therrDollarReserves / totalCoinsInCirculation) * 0.90
```

**Earning Coins:**
1. Complete achievements → earn `unclaimedRewardPts`
2. Claim achievement → points added to `settingsTherrCoinTotal`
3. Exchange coins for gift cards/cash (premium feature)

### Achievement Classes (12 Total)

| Class | Theme | Example Achievement |
|-------|-------|---------------------|
| `activist` | Community impact | Organize local events |
| `communityLeader` | Group management | Lead active groups |
| `critic` | Reviews/ratings | Write helpful reviews |
| `entrepreneur` | Business creation | Create business spaces |
| `eventPlanner` | Event hosting | Host successful events |
| `explorer` | Discovery | Activate 100 moments |
| `humanitarian` | Helping others | Support community members |
| `influencer` | Content creation | Earn 500 likes |
| `journalist` | Storytelling | Create quality content |
| `socialite` | Connections | Make 50 connections |
| `thinker` | Thoughtful content | Share insightful thoughts |
| `tourGuide` | Local expertise | Share local knowledge |

### Achievement Structure

```typescript
interface IAchievement {
  id: string;                    // e.g., 'explorer_1_1'
  title: string;                 // e.g., 'Novice Explorer'
  description: string;           // e.g., 'Activate 10 Moments'
  countToComplete: number;       // Progress threshold (10)
  pointReward: number;           // TherrCoins to award (0.25)
  xp: number;                    // Experience points (unused)
  tier: string;                  // Tier classification ('1_1')
  prerequisite: (userAchievements) => boolean;  // Gate function
  version: number;               // Config version
}
```

### Tiered Progression Example (Explorer)

```
explorer_1_1:    Activate 10 Moments   → 0.25 coins
explorer_1_1_1:  Activate 100 Moments  → 0.50 coins (requires explorer_1_1)
explorer_1_1_2:  Activate 500 Moments  → 1.00 coins
explorer_1_1_3:  Activate 1,000 Moments → 1.50 coins
explorer_1_1_4:  Activate 2,500 Moments → 2.00 coins
explorer_1_1_5:  Activate 5,000 Moments → 2.50 coins
explorer_1_1_6:  Activate 10,000 Moments → 3.00 coins
```

---

## Database Schema: Current

### userAchievements Table

```sql
CREATE TABLE main.userAchievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Achievement Reference
    achievementId VARCHAR NOT NULL,     -- 'explorer_1_1'
    achievementClass VARCHAR NOT NULL,  -- 'explorer'
    achievementTier VARCHAR NOT NULL,   -- '1_1'

    -- Progress
    progressCount INTEGER DEFAULT 0,
    countToComplete INTEGER,            -- Cached from config

    -- Completion
    completedAt TIMESTAMP,
    unclaimedRewardPts DECIMAL DEFAULT 0,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_achievements_user ON userAchievements(userId);
CREATE INDEX idx_achievements_id ON userAchievements(achievementId);
CREATE INDEX idx_achievements_class ON userAchievements(achievementClass);
```

---

## Key Files & Code Paths

### Backend (users-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/userAchievements.ts` | Achievement CRUD | `getMyAchievements()`, `claimAchievement()` |
| `src/handlers/rewards.ts` | Coin management | `transferCoins()`, `requestRewardsExchange()` |
| `src/store/UserAchievementsStore.ts` | Database queries | `updateAndCreateConsecutive()` |

### Achievement Configs (therr-js-utilities)

| File | Purpose |
|------|---------|
| `src/config/achievements/index.ts` | All achievement classes |
| `src/config/achievements/explorer.ts` | Explorer achievements |
| `src/config/achievements/influencer.ts` | Influencer achievements |
| `src/config/achievements/socialite.ts` | Connection achievements |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/assets/achievement-confetti.json` | Celebration animation |
| `main/assets/achievement-confetti-2.json` | Alternative animation |

---

## API Endpoints: Current

```
GET /users-service/users/achievements
  Response: { achievements: { [id]: IAchievement } }

POST /users-service/users/achievements/:id/claim
  Response: { achievement, user: { settingsTherrCoinTotal } }

GET /users-service/rewards/exchange-rate
  Response: { rate: number }

POST /users-service/rewards
  Body: { amount, provider: 'amazon' | 'paypal' }
  Response: { transactionId, status }
```

---

## Repurposing for HABITS: Streak Achievements

### Concept Mapping

| Therr Concept | HABITS Concept | Notes |
|---------------|----------------|-------|
| Achievement Class | Streak Category | habitBuilder, consistency, etc. |
| `progressCount` | `currentStreak` | Consecutive days |
| `countToComplete` | `streakMilestone` | 7, 14, 30, 100 days |
| `pointReward` | Keep or simplify | Coins or just badges |
| Achievement Tier | Streak Tier | Bronze → Silver → Gold |

### Streak vs Count-Based Logic

**Current (Count-Based):**
```
Progress: 0 → 1 → 2 → ... → 100 (never resets)
Achievement completes when progressCount >= countToComplete
```

**Needed (Streak-Based):**
```
Streak: 0 → 1 → 2 → 7 (achievement!) → 8 → 14 (achievement!) → 15 → MISS → 0 (reset!)
Achievement completes when streak reaches milestone
Streak resets to 0 if day missed
```

---

## New Schema: Streak Tracking

### Option A: Extend userAchievements

```sql
ALTER TABLE main.userAchievements ADD COLUMN (
    -- Streak Tracking
    achievementType VARCHAR(20) DEFAULT 'count',  -- 'count' or 'streak'
    currentStreak INTEGER DEFAULT 0,
    longestStreak INTEGER DEFAULT 0,
    lastCompletedDate DATE,

    -- Streak Config
    resetOnMiss BOOLEAN DEFAULT true,
    gracePeriodHours INTEGER DEFAULT 0,          -- Hours past midnight to complete
    streakMilestone INTEGER                       -- Target days for this achievement
);

CREATE INDEX idx_achievements_streak ON userAchievements(currentStreak)
  WHERE achievementType = 'streak';
```

### Option B: Separate streaks Table (Recommended)

```sql
CREATE TABLE habits.streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    userId UUID NOT NULL REFERENCES users(id),
    pactId UUID REFERENCES habits.pacts(id),     -- Optional pact context
    habitGoalId UUID REFERENCES habits.habit_goals(id),

    -- Streak Data
    currentStreak INTEGER DEFAULT 0,
    longestStreak INTEGER DEFAULT 0,
    lastCompletedDate DATE,
    lastCompletedAt TIMESTAMP,

    -- Stats
    totalCompletions INTEGER DEFAULT 0,
    totalMisses INTEGER DEFAULT 0,
    completionRate DECIMAL(5,2),                 -- Percentage

    -- Config
    gracePeriodHours INTEGER DEFAULT 4,          -- Hours past midnight

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(userId, habitGoalId)
);

CREATE INDEX idx_streaks_user ON habits.streaks(userId);
CREATE INDEX idx_streaks_current ON habits.streaks(currentStreak DESC);
CREATE INDEX idx_streaks_longest ON habits.streaks(longestStreak DESC);
```

### Streak History Table

```sql
CREATE TABLE habits.streak_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    streakId UUID NOT NULL REFERENCES habits.streaks(id),
    userId UUID NOT NULL,

    -- Event
    eventType VARCHAR(20) NOT NULL,  -- 'complete', 'miss', 'reset'
    eventDate DATE NOT NULL,
    streakValueBefore INTEGER,
    streakValueAfter INTEGER,

    -- Context
    proofId UUID,                    -- Reference to proof upload
    notes TEXT,

    createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_streak ON habits.streak_history(streakId);
CREATE INDEX idx_history_date ON habits.streak_history(eventDate);
```

---

## New Achievement Classes for HABITS

### habitBuilder Class

```typescript
// therr-js-utilities/src/config/achievements/habitBuilder.ts
export default {
  // Tier 1: First Streaks
  habitBuilder_1_1: {
    title: 'First Steps',
    description: 'Complete a 3-day streak',
    countToComplete: 3,
    achievementType: 'streak',
    pointReward: 0.10,
    tier: '1_1',
    prerequisite: () => true,
  },
  habitBuilder_1_1_1: {
    title: 'Building Momentum',
    description: 'Complete a 7-day streak',
    countToComplete: 7,
    achievementType: 'streak',
    pointReward: 0.25,
    tier: '1_1',
    prerequisite: (a) => !!a.habitBuilder_1_1?.completedAt,
  },
  habitBuilder_1_1_2: {
    title: 'Habit Forming',
    description: 'Complete a 14-day streak',
    countToComplete: 14,
    achievementType: 'streak',
    pointReward: 0.50,
    tier: '1_1',
    prerequisite: (a) => !!a.habitBuilder_1_1_1?.completedAt,
  },
  habitBuilder_1_1_3: {
    title: 'Month Master',
    description: 'Complete a 30-day streak',
    countToComplete: 30,
    achievementType: 'streak',
    pointReward: 1.00,
    tier: '1_1',
    prerequisite: (a) => !!a.habitBuilder_1_1_2?.completedAt,
  },
  habitBuilder_1_1_4: {
    title: 'Quarter Champion',
    description: 'Complete a 90-day streak',
    countToComplete: 90,
    achievementType: 'streak',
    pointReward: 2.50,
    tier: '1_1',
    prerequisite: (a) => !!a.habitBuilder_1_1_3?.completedAt,
  },
  habitBuilder_1_1_5: {
    title: 'Habit Legend',
    description: 'Complete a 365-day streak',
    countToComplete: 365,
    achievementType: 'streak',
    pointReward: 10.00,
    tier: '1_1',
    prerequisite: (a) => !!a.habitBuilder_1_1_4?.completedAt,
  },
};
```

### consistency Class

```typescript
// Perfect weeks/months
export default {
  consistency_1_1: {
    title: 'Perfect Week',
    description: 'Complete all habits for 7 consecutive days',
    countToComplete: 7,
    achievementType: 'streak',
    pointReward: 0.50,
  },
  consistency_1_2: {
    title: 'Perfect Month',
    description: 'Complete all habits for 30 consecutive days',
    countToComplete: 30,
    achievementType: 'streak',
    pointReward: 2.00,
  },
};
```

### accountability Class

```typescript
// Partner-related achievements
export default {
  accountability_1_1: {
    title: 'Better Together',
    description: 'Complete a pact with 80%+ success rate',
    achievementType: 'count',
    countToComplete: 1,
    pointReward: 1.00,
  },
  accountability_1_2: {
    title: 'Accountability Pro',
    description: 'Complete 5 pacts successfully',
    achievementType: 'count',
    countToComplete: 5,
    pointReward: 2.50,
  },
  accountability_1_3: {
    title: 'Habit Champion',
    description: 'Help 10 partners complete their pacts',
    achievementType: 'count',
    countToComplete: 10,
    pointReward: 5.00,
  },
};
```

### resilience Class

```typescript
// Comeback achievements
export default {
  resilience_1_1: {
    title: 'Bounce Back',
    description: 'Restart a streak after breaking it',
    achievementType: 'count',
    countToComplete: 1,
    pointReward: 0.25,
  },
  resilience_1_2: {
    title: 'Never Give Up',
    description: 'Restart streaks 5 times and keep going',
    achievementType: 'count',
    countToComplete: 5,
    pointReward: 1.00,
  },
};
```

---

## Streak Calculation Logic

### Daily Streak Update

```typescript
// therr-services/users-service/src/utilities/streakHelpers.ts

interface StreakUpdateResult {
  streakBefore: number;
  streakAfter: number;
  longestStreak: number;
  achievementsUnlocked: string[];
  isNewRecord: boolean;
}

const updateStreak = async (
  userId: string,
  habitGoalId: string,
  completedAt: Date = new Date()
): Promise<StreakUpdateResult> => {
  const streak = await StreaksStore.findByUserAndGoal(userId, habitGoalId);

  const today = startOfDay(completedAt);
  const lastCompleted = streak?.lastCompletedDate
    ? startOfDay(streak.lastCompletedDate)
    : null;

  let newStreak: number;
  let achievementsUnlocked: string[] = [];

  if (!lastCompleted) {
    // First ever completion
    newStreak = 1;
  } else if (isSameDay(today, lastCompleted)) {
    // Already completed today
    return {
      streakBefore: streak.currentStreak,
      streakAfter: streak.currentStreak,
      longestStreak: streak.longestStreak,
      achievementsUnlocked: [],
      isNewRecord: false,
    };
  } else if (isYesterday(lastCompleted, today)) {
    // Consecutive day - increment streak
    newStreak = streak.currentStreak + 1;
  } else {
    // Missed day(s) - check grace period
    const hoursSinceDeadline = differenceInHours(
      completedAt,
      addHours(startOfDay(today), streak.gracePeriodHours || 4)
    );

    if (hoursSinceDeadline < 0 && isYesterday(lastCompleted, addDays(today, -1))) {
      // Within grace period, yesterday's streak continues
      newStreak = streak.currentStreak + 1;
    } else {
      // Streak broken
      await logStreakBreak(streak.id, streak.currentStreak);
      newStreak = 1;
    }
  }

  // Check for new longest streak
  const isNewRecord = newStreak > (streak?.longestStreak || 0);
  const longestStreak = Math.max(newStreak, streak?.longestStreak || 0);

  // Update streak record
  await StreaksStore.update(streak.id, {
    currentStreak: newStreak,
    longestStreak,
    lastCompletedDate: today,
    lastCompletedAt: completedAt,
    totalCompletions: streak.totalCompletions + 1,
  });

  // Check for milestone achievements
  achievementsUnlocked = await checkStreakMilestones(userId, newStreak);

  return {
    streakBefore: streak?.currentStreak || 0,
    streakAfter: newStreak,
    longestStreak,
    achievementsUnlocked,
    isNewRecord,
  };
};
```

### Milestone Check

```typescript
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

const checkStreakMilestones = async (
  userId: string,
  currentStreak: number
): Promise<string[]> => {
  const unlocked: string[] = [];

  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak >= milestone) {
      const achievementId = `habitBuilder_streak_${milestone}`;
      const existing = await UserAchievementsStore.findById(userId, achievementId);

      if (!existing?.completedAt) {
        await UserAchievementsStore.complete(userId, achievementId);
        unlocked.push(achievementId);
      }
    }
  }

  return unlocked;
};
```

---

## API Endpoints: New

### Streak Management

```
GET /users-service/streaks
  Query: { habitGoalId?, pactId? }
  Response: { streaks: IStreak[] }

GET /users-service/streaks/:habitGoalId
  Response: {
    currentStreak,
    longestStreak,
    lastCompletedDate,
    totalCompletions,
    completionRate,
    history: IStreakEvent[]
  }

POST /users-service/streaks/:habitGoalId/complete
  Body: { proofId?, notes? }
  Response: {
    streak,
    achievementsUnlocked: string[],
    isNewRecord: boolean
  }

GET /users-service/streaks/leaderboard
  Query: { habitGoalId?, timeframe?: 'week' | 'month' | 'all' }
  Response: { rankings: { userId, streak, rank }[] }
```

### Achievement Queries

```
GET /users-service/achievements/streaks
  Response: { achievements grouped by streak category }

GET /users-service/achievements/available
  Response: { achievements user can work toward }
```

---

## Mobile Components

### Streak Display Widget

```typescript
// TherrMobile/main/components/StreakWidget.tsx
interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Date;
  habitName: string;
}

const StreakWidget = ({ currentStreak, longestStreak, lastCompletedDate, habitName }) => {
  const isAtRisk = isYesterday(lastCompletedDate) && !isToday(lastCompletedDate);

  return (
    <View style={styles.container}>
      <View style={styles.flameContainer}>
        <AnimatedFlame size={currentStreak} isAtRisk={isAtRisk} />
        <Text style={styles.streakNumber}>{currentStreak}</Text>
      </View>
      <Text style={styles.label}>{habitName}</Text>
      <Text style={styles.record}>Best: {longestStreak} days</Text>
      {isAtRisk && (
        <Text style={styles.warning}>Complete today to keep your streak!</Text>
      )}
    </View>
  );
};
```

### Achievement Celebration

```typescript
// Reuse existing confetti animation
import LottieView from 'lottie-react-native';

const AchievementCelebration = ({ achievement, onDismiss }) => (
  <Modal visible={true} transparent>
    <View style={styles.overlay}>
      <LottieView
        source={require('../assets/achievement-confetti.json')}
        autoPlay
        loop={false}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.description}>{achievement.description}</Text>
        <Text style={styles.reward}>+{achievement.pointReward} coins</Text>
        <Button title="Claim" onPress={onDismiss} />
      </View>
    </View>
  </Modal>
);
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create `habits.streaks` table migration
- [ ] Create `habits.streak_history` table migration
- [ ] Add streak-related indexes

### Phase 2: Achievement Configs
- [ ] Create `habitBuilder.ts` achievement class
- [ ] Create `consistency.ts` achievement class
- [ ] Create `accountability.ts` achievement class
- [ ] Create `resilience.ts` achievement class
- [ ] Update achievement index to include new classes

### Phase 3: Backend Logic
- [ ] Create `src/utilities/streakHelpers.ts`
- [ ] Create `src/store/StreaksStore.ts`
- [ ] Create `src/handlers/streaks.ts`
- [ ] Integrate streak updates with habit check-in flow
- [ ] Add streak milestone detection

### Phase 4: API
- [ ] Add streak routes to router
- [ ] Implement leaderboard endpoint
- [ ] Add streak stats to user profile response

### Phase 5: Mobile UI
- [ ] Create `StreakWidget` component
- [ ] Create streak history view
- [ ] Add streak display to habit cards
- [ ] Integrate achievement celebration modal
- [ ] Add "at risk" notifications

### Phase 6: Notifications
- [ ] Add streak milestone notifications
- [ ] Add "streak at risk" reminder (evening)
- [ ] Add streak broken notification
- [ ] Add new personal record celebration

---

## Gamification Enhancements (Future)

### Streak Shields (Premium)
- Protect streak for 1 missed day
- Earned or purchased
- Limited uses per month

### Streak Multipliers
- Consecutive weeks add multiplier
- 2x coins after 2 weeks
- 3x coins after month

### Social Leaderboards
- Weekly/monthly rankings
- Friend comparisons
- Pact partner comparisons

### Badges & Trophies
- Visual collectibles
- Profile display
- Shareable achievements
