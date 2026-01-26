# HABITS Notifications Design

## Executive Summary

The Therr push notification system uses Firebase Cloud Messaging (FCM) with multi-brand support and a two-layer mobile architecture (Firebase + Notifee). For HABITS, we add habit-specific notification types (reminders, partner alerts, streak warnings) and leverage Notifee's scheduled notification capability for daily reminders.

**Reuse Level**: 80% - Full infrastructure reusable, add new notification types

---

## Current Implementation

### Architecture Overview

```
Backend Service
    ↓
POST /push-notifications-service/v1/notifications/send
    ↓
Firebase Admin SDK (firebase-admin)
    ↓
FCM (Firebase Cloud Messaging)
    ↓
Mobile Device
    ↓
@react-native-firebase/messaging (receives)
    ↓
@notifee/react-native (displays)
```

### Multi-Brand Support

```typescript
// firebaseAdmin.ts
const getAppBundleIdentifier = (brandVariation: BrandVariations) => {
  switch (brandVariation) {
    case BrandVariations.THERR:
      return 'com.therr.mobile.Therr';
    case BrandVariations.TEEM:
      return 'com.therr.mobile.Teem';
    case BrandVariations.HABITS:  // NEW
      return 'com.therr.mobile.Habits';
    default:
      return 'com.therr.mobile.Therr';
  }
};
```

Each brand has its own Firebase project with separate credentials.

---

## Database Schema

### Notifications Table

```sql
CREATE TABLE main.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID NOT NULL REFERENCES users(id),

    -- Content
    type VARCHAR(50) NOT NULL,
    messageLocaleKey VARCHAR(100),
    messageParams JSONB,

    -- Status
    isRead BOOLEAN DEFAULT false,
    isArchived BOOLEAN DEFAULT false,

    -- Context
    fromUserId UUID,
    areaId UUID,
    groupId UUID,
    mediaId UUID,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(userId);
CREATE INDEX idx_notifications_read ON notifications(userId, isRead);
CREATE INDEX idx_notifications_type ON notifications(type);
```

### User Notification Preferences

```sql
-- In users table
deviceMobileFirebaseToken VARCHAR,   -- FCM token
settingsPushMarketing BOOLEAN,
settingsPushInvites BOOLEAN,
settingsPushLikes BOOLEAN,
settingsPushMentions BOOLEAN,
settingsPushMessages BOOLEAN,
settingsPushReminders BOOLEAN,
settingsPushTopics JSONB,           -- Subscribed FCM topics
```

---

## Key Files & Code Paths

### Backend (push-notifications-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/api/firebaseAdmin.ts` | FCM integration | `initializeApp()`, `createMessage()` |
| `src/handlers/notifications.ts` | Send notifications | `predictAndSendPushNotification()` |
| `src/handlers/locationProcessing.ts` | Geo-triggered | `processUserLocationChange()` |
| `src/locales/` | Translations | Notification message templates |

### Shared Library (therr-js-utilities)

| File | Purpose |
|------|---------|
| `src/constants/enums/PushNotifications.ts` | Notification type enum |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/utilities/pushNotifications.ts` | FCM setup, token management |
| `main/components/Layout.tsx` | Notification handlers, navigation |

---

## Current Notification Types

```typescript
// therr-js-utilities/src/constants/enums/PushNotifications.ts
enum PushNotifications {
  // Achievements
  achievementCompleted = 'achievementCompleted',

  // Connections
  newConnectionRequest = 'newConnectionRequest',
  connectionRequestAccepted = 'connectionRequestAccepted',

  // Messaging
  newDirectMessage = 'newDirectMessage',
  newGroupInvite = 'newGroupInvite',
  newGroupMessage = 'newGroupMessage',
  newGroupMembers = 'newGroupMembers',

  // Engagement
  newLikeReceived = 'newLikeReceived',
  newSuperLikeReceived = 'newSuperLikeReceived',
  newThoughtReplyReceived = 'newThoughtReplyReceived',

  // Location-Based
  newAreasActivated = 'newAreasActivated',
  proximityRequiredMoment = 'proximityRequiredMoment',
  proximityRequiredSpace = 'proximityRequiredSpace',
  nudgeSpaceEngagement = 'nudgeSpaceEngagement',

  // Reminders
  createYourProfileReminder = 'createYourProfileReminder',
  createAMomentReminder = 'createAMomentReminder',
  unreadNotificationsReminder = 'unreadNotificationsReminder',
  unclaimedAchievementsReminder = 'unclaimedAchievementsReminder',

  // Stats
  latestPostLikesStats = 'latestPostLikesStats',
  latestPostViewcountStats = 'latestPostViewcountStats',
}
```

---

## API Endpoints

### Send Notification

```
POST /push-notifications-service/v1/notifications/send
  Headers: {
    Authorization: Bearer <token>,
    x-brand-variation: 'therr' | 'teem' | 'habits'
  }
  Body: {
    userId: string,
    type: PushNotifications,
    data?: {
      fromUserName?: string,
      groupName?: string,
      achievementsCount?: number,
      ...
    }
  }
  Response: { success: boolean, messageId?: string }

POST /push-notifications-service/v1/notifications/send-multiple
  Body: {
    users: [{ id, deviceToken, shouldMuteNotifs }],
    type: PushNotifications,
    data?: object
  }
  Response: { sent: number, failed: number }
```

---

## Mobile Notification Handling

### Two-Layer System

**Layer 1: Firebase Messaging**
- Receives FCM messages
- Handles background delivery
- Triggers Notifee for display

**Layer 2: Notifee**
- Displays notifications
- Manages notification channels
- Handles click actions
- Supports scheduled notifications (unused currently)

### Android Notification Channels

```typescript
// TherrMobile/main/constants/index.tsx
enum AndroidChannelIds {
  default = 'default',
  contentDiscovery = 'contentDiscovery',
  rewardUpdates = 'rewardUpdates',    // HIGH importance
  reminders = 'reminders',             // HIGH importance
}
```

### Notification Click Handling

```typescript
// Layout.tsx - Simplified
const handleNotificationPress = (notification) => {
  const { type, data } = notification;

  switch (type) {
    case PushNotifications.newDirectMessage:
      navigation.navigate('DirectMessage', { recipientId: data.fromUserId });
      break;
    case PushNotifications.newConnectionRequest:
      navigation.navigate('Connect');
      break;
    case PushNotifications.achievementCompleted:
      navigation.navigate('Achievements');
      break;
    // ... other cases
  }
};
```

---

## New Notification Types for HABITS

### Add to PushNotifications Enum

```typescript
enum PushNotifications {
  // ... existing types ...

  // === HABITS-SPECIFIC ===

  // Pact Lifecycle
  pactInvitation = 'pactInvitation',
  pactAccepted = 'pactAccepted',
  pactDeclined = 'pactDeclined',
  pactCompleted = 'pactCompleted',
  pactExpiring = 'pactExpiring',           // X days remaining

  // Partner Activity
  partnerCheckedIn = 'partnerCheckedIn',
  partnerMissedDay = 'partnerMissedDay',
  partnerCelebrated = 'partnerCelebrated', // Partner sent encouragement

  // Streaks
  streakMilestone = 'streakMilestone',     // 7, 14, 30, 100 days
  streakAtRisk = 'streakAtRisk',           // Haven't checked in today
  streakBroken = 'streakBroken',
  newPersonalRecord = 'newPersonalRecord',

  // Daily Reminders
  dailyHabitReminder = 'dailyHabitReminder',
  morningMotivation = 'morningMotivation',
  eveningCheckIn = 'eveningCheckIn',

  // Consequences (Premium)
  consequenceTriggered = 'consequenceTriggered',
}
```

---

## Notification Message Templates

### Add to Locales

```typescript
// push-notifications-service/src/locales/en.json
{
  "notifications": {
    // Pact Lifecycle
    "pactInvitation": {
      "title": "New Pact Invitation",
      "body": "{fromUserName} wants to start a habit pact with you!"
    },
    "pactAccepted": {
      "title": "Pact Accepted!",
      "body": "{fromUserName} accepted your pact. Let's build this habit together!"
    },
    "pactCompleted": {
      "title": "Pact Completed!",
      "body": "You and {partnerName} finished your {habitName} pact!"
    },
    "pactExpiring": {
      "title": "Pact Ending Soon",
      "body": "Your {habitName} pact ends in {daysRemaining} days"
    },

    // Partner Activity
    "partnerCheckedIn": {
      "title": "Your partner is on it!",
      "body": "{partnerName} just completed {habitName}"
    },
    "partnerMissedDay": {
      "title": "Your partner needs encouragement",
      "body": "{partnerName} hasn't checked in for {habitName} today"
    },
    "partnerCelebrated": {
      "title": "High Five!",
      "body": "{partnerName} celebrated your progress"
    },

    // Streaks
    "streakMilestone": {
      "title": "Streak Milestone!",
      "body": "You're on a {streakDays}-day streak for {habitName}!"
    },
    "streakAtRisk": {
      "title": "Don't break your streak!",
      "body": "Complete {habitName} today to keep your {streakDays}-day streak"
    },
    "streakBroken": {
      "title": "Streak Reset",
      "body": "Your {habitName} streak ended at {streakDays} days. Start fresh!"
    },
    "newPersonalRecord": {
      "title": "New Personal Record!",
      "body": "{streakDays} days is your longest {habitName} streak ever!"
    },

    // Daily Reminders
    "dailyHabitReminder": {
      "title": "Time for {habitName}",
      "body": "Keep your {streakDays}-day streak going!"
    },
    "morningMotivation": {
      "title": "Good morning!",
      "body": "You have {habitCount} habits to complete today"
    },
    "eveningCheckIn": {
      "title": "End of day check",
      "body": "Did you complete {habitName}? Check in now!"
    }
  }
}
```

---

## Scheduled Notifications (New)

### Notifee Trigger Notifications

The mobile app already has Notifee installed, which supports local scheduled notifications. Currently unused.

```typescript
// TherrMobile/main/utilities/scheduledNotifications.ts

import notifee, { TriggerType, TimestampTrigger } from '@notifee/react-native';

interface ScheduleReminderParams {
  habitGoalId: string;
  habitName: string;
  scheduledTime: Date;
  streakDays: number;
}

const scheduleHabitReminder = async ({
  habitGoalId,
  habitName,
  scheduledTime,
  streakDays,
}: ScheduleReminderParams) => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: scheduledTime.getTime(),
    alarmManager: {
      allowWhileIdle: true,  // Doze mode bypass
    },
  };

  await notifee.createTriggerNotification(
    {
      id: `habit-reminder-${habitGoalId}`,
      title: `Time for ${habitName}`,
      body: streakDays > 0
        ? `Keep your ${streakDays}-day streak going!`
        : 'Start building your streak today!',
      android: {
        channelId: 'reminders',
        pressAction: { id: 'default' },
      },
      data: {
        type: 'dailyHabitReminder',
        habitGoalId,
      },
    },
    trigger
  );
};

const cancelHabitReminder = async (habitGoalId: string) => {
  await notifee.cancelNotification(`habit-reminder-${habitGoalId}`);
};

const scheduleAllDailyReminders = async (habits: IHabitGoal[]) => {
  // Cancel existing
  const existing = await notifee.getTriggerNotifications();
  for (const notif of existing) {
    if (notif.notification.id?.startsWith('habit-reminder-')) {
      await notifee.cancelNotification(notif.notification.id);
    }
  }

  // Schedule new
  for (const habit of habits) {
    if (habit.reminderTime) {
      const nextReminderTime = getNextOccurrence(habit.reminderTime);
      await scheduleHabitReminder({
        habitGoalId: habit.id,
        habitName: habit.name,
        scheduledTime: nextReminderTime,
        streakDays: habit.currentStreak,
      });
    }
  }
};
```

### Repeating Notifications

```typescript
import { RepeatFrequency } from '@notifee/react-native';

const scheduleDailyReminder = async (habitGoalId: string, habitName: string, hour: number, minute: number) => {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: scheduledTime.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,  // Repeat daily
  };

  await notifee.createTriggerNotification(
    {
      id: `daily-${habitGoalId}`,
      title: `Time for ${habitName}`,
      body: 'Tap to check in',
      android: { channelId: 'reminders' },
      data: { type: 'dailyHabitReminder', habitGoalId },
    },
    trigger
  );
};
```

---

## New Android Notification Channel

```typescript
// Add to TherrMobile/main/constants/index.tsx
enum AndroidChannelIds {
  default = 'default',
  contentDiscovery = 'contentDiscovery',
  rewardUpdates = 'rewardUpdates',
  reminders = 'reminders',
  habits = 'habits',  // NEW - for habit-specific notifications
}

// In Layout.tsx or initialization
await notifee.createChannel({
  id: 'habits',
  name: 'Habit Reminders',
  description: 'Daily habit reminders and partner updates',
  importance: AndroidImportance.HIGH,
  sound: 'default',
  vibration: true,
  lights: true,
});
```

---

## Notification Preferences (New)

### User Settings Schema

```sql
ALTER TABLE main.users ADD COLUMN (
  -- Habit-specific preferences
  settingsPushHabitReminders BOOLEAN DEFAULT true,
  settingsPushPartnerActivity BOOLEAN DEFAULT true,
  settingsPushStreakAlerts BOOLEAN DEFAULT true,
  settingsDefaultReminderTime TIME DEFAULT '09:00:00',
  settingsQuietHoursStart TIME,
  settingsQuietHoursEnd TIME
);
```

### Mobile Settings UI

```typescript
// TherrMobile/main/routes/Settings/HabitNotifications.tsx
const HabitNotificationSettings = () => {
  const [settings, setSettings] = useState({
    habitReminders: true,
    partnerActivity: true,
    streakAlerts: true,
    defaultReminderTime: '09:00',
    quietHoursStart: null,
    quietHoursEnd: null,
  });

  return (
    <View>
      <SettingsToggle
        label="Daily Habit Reminders"
        value={settings.habitReminders}
        onChange={(v) => updateSetting('habitReminders', v)}
      />

      <SettingsToggle
        label="Partner Activity"
        description="Get notified when your partner checks in"
        value={settings.partnerActivity}
        onChange={(v) => updateSetting('partnerActivity', v)}
      />

      <SettingsToggle
        label="Streak Alerts"
        description="Warnings when your streak is at risk"
        value={settings.streakAlerts}
        onChange={(v) => updateSetting('streakAlerts', v)}
      />

      <TimePicker
        label="Default Reminder Time"
        value={settings.defaultReminderTime}
        onChange={(v) => updateSetting('defaultReminderTime', v)}
      />

      <QuietHoursPicker
        start={settings.quietHoursStart}
        end={settings.quietHoursEnd}
        onChange={(start, end) => {
          updateSetting('quietHoursStart', start);
          updateSetting('quietHoursEnd', end);
        }}
      />
    </View>
  );
};
```

---

## Backend Notification Triggers

### On Habit Check-in

```typescript
// habits-service/src/handlers/habitCheckins.ts
const createCheckin = async (req, res) => {
  const checkin = await HabitCheckinsStore.create(req.body);

  // Notify pact partner
  if (checkin.pactId) {
    const pact = await PactsStore.findById(checkin.pactId);
    const partnerId = pact.creatorUserId === req.user.id
      ? pact.partnerUserId
      : pact.creatorUserId;

    await sendPushNotification({
      userId: partnerId,
      type: PushNotifications.partnerCheckedIn,
      data: {
        fromUserName: req.user.userName,
        habitName: checkin.habitGoal.name,
        checkinId: checkin.id,
      },
    });
  }

  // Check for streak milestone
  if (STREAK_MILESTONES.includes(checkin.streakDayNumber)) {
    await sendPushNotification({
      userId: req.user.id,
      type: PushNotifications.streakMilestone,
      data: {
        streakDays: checkin.streakDayNumber,
        habitName: checkin.habitGoal.name,
      },
    });
  }

  return res.json({ checkin });
};
```

### Streak At-Risk Notification (Scheduled Job)

```typescript
// habits-service/src/jobs/streakWarnings.ts
// Run via cron at 6 PM local time

const sendStreakAtRiskNotifications = async () => {
  // Find users who haven't checked in today but have active streaks
  const atRiskUsers = await HabitCheckinsStore.findStreaksAtRisk();

  for (const streak of atRiskUsers) {
    await sendPushNotification({
      userId: streak.userId,
      type: PushNotifications.streakAtRisk,
      data: {
        habitName: streak.habitGoal.name,
        streakDays: streak.currentStreak,
      },
    });
  }
};
```

---

## Implementation Checklist

### Phase 1: Backend
- [ ] Add habit notification types to `PushNotifications` enum
- [ ] Add translation templates to locales
- [ ] Add notification preferences columns to users table
- [ ] Update `sendPushNotification` to handle new types

### Phase 2: Mobile - Channels & Setup
- [ ] Create `habits` notification channel
- [ ] Update `pushNotifications.ts` for HABITS brand
- [ ] Add notification preferences to settings screen

### Phase 3: Mobile - Scheduled Notifications
- [ ] Create `scheduledNotifications.ts` utility
- [ ] Implement `scheduleHabitReminder()` with Notifee triggers
- [ ] Implement `scheduleDailyReminders()` batch scheduling
- [ ] Hook into habit CRUD to update schedules

### Phase 4: Mobile - Click Handling
- [ ] Add habit notification click handlers to Layout.tsx
- [ ] Navigate to appropriate screens (pact detail, check-in)
- [ ] Handle deep links for notifications

### Phase 5: Backend - Triggers
- [ ] Send `partnerCheckedIn` on check-in creation
- [ ] Send `streakMilestone` on milestone reached
- [ ] Create cron job for `streakAtRisk` (evening)
- [ ] Create cron job for `partnerMissedDay` (next day)

### Phase 6: Testing
- [ ] Test all notification types on iOS
- [ ] Test all notification types on Android
- [ ] Test scheduled notification reliability
- [ ] Test notification preferences respect

---

## Key Integration Points

### Firebase Setup for HABITS Brand

1. Create Firebase project: `therr-habits`
2. Add iOS app: `com.therr.mobile.Habits`
3. Add Android app: `com.therr.mobile.Habits`
4. Download `google-services.json` and `GoogleService-Info.plist`
5. Add credentials to push-notifications-service environment

### Environment Variables

```bash
# push-notifications-service/.env
PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS=<base64 encoded service account JSON>
```

### Brand Detection in Handler

```typescript
// handlers/notifications.ts
const getFirebaseApp = (brandVariation: BrandVariations) => {
  switch (brandVariation) {
    case BrandVariations.HABITS:
      return firebase.app('habits');  // Named Firebase instance
    default:
      return firebase.app();
  }
};
```
