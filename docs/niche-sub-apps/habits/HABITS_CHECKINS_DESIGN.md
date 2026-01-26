# HABITS Check-ins Design

## Executive Summary

Therr "Moments" are location-based content posts with geospatial indexing. For HABITS, we create **habit check-ins** - daily completion records without location requirements. The existing infrastructure (media attachments, reactions, feed queries) is reusable with location fields made optional.

**Reuse Level**: 65% - Core structure reusable, location logic needs bypass

---

## Current Implementation: Moments

### What is a Moment?

A Moment is a geotagged post users create when "checking in" to a location. It includes:
- Text content (message)
- Optional media (photos)
- Required GPS coordinates
- Category classification
- Privacy controls

### Moment Creation Flow

```
Mobile App
    ↓
GPS coordinates captured
    ↓
POST /maps-service/moments
    ↓
Validate coordinates + reverse geocode
    ↓
Create moment record
    ↓
Create initial reaction (userHasActivated: true)
    ↓
Async content safety check (Sightengine)
    ↓
Return moment with signed media URLs
```

---

## Database Schema: Moments

### Main Table (30+ Fields)

```sql
CREATE TABLE main.moments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fromUserId UUID NOT NULL REFERENCES users(id),

    -- Content
    message TEXT DEFAULT '',
    notificationMsg VARCHAR(100),    -- Truncated for push
    category VARCHAR(50) DEFAULT 'uncategorized',
    areaType VARCHAR(25) DEFAULT 'moments',

    -- LOCATION (Currently Required)
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,  -- PostGIS indexed
    radius FLOAT,
    maxProximity FLOAT,
    doesRequireProximityToView BOOLEAN DEFAULT false,
    region VARCHAR,                  -- Country/region from geocoding

    -- Media
    mediaIds TEXT DEFAULT '',        -- Legacy: comma-separated IDs
    medias JSONB,                    -- New: [{path, type}]

    -- Content Flags
    isPublic BOOLEAN DEFAULT false,
    isDraft BOOLEAN DEFAULT false,
    isMatureContent BOOLEAN DEFAULT false,
    isModeratorApproved BOOLEAN DEFAULT false,

    -- Metadata
    locale VARCHAR(8),
    mentionsIds TEXT DEFAULT '',
    hashTags TEXT DEFAULT '',
    interestsKeys JSONB,

    -- Space Integration
    spaceId UUID REFERENCES spaces(id),

    -- Engagement
    maxViews INTEGER DEFAULT 0,
    valuation INTEGER DEFAULT 0,

    -- Timestamps
    expiresAt TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_moments_geom ON moments USING GIST(geom);  -- Geospatial
CREATE INDEX idx_moments_user ON moments(fromUserId);
CREATE INDEX idx_moments_created ON moments(createdAt DESC);
CREATE INDEX idx_moments_interests ON moments USING GIN(interestsKeys);
```

### Reactions Table

```sql
CREATE TABLE main.momentReactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    momentId UUID NOT NULL REFERENCES moments(id),
    userId UUID NOT NULL REFERENCES users(id),

    -- Reaction States
    userHasActivated BOOLEAN DEFAULT false,
    userHasLiked BOOLEAN DEFAULT false,
    userHasSuperLiked BOOLEAN DEFAULT false,
    userHasDisliked BOOLEAN DEFAULT false,
    userHasSuperDisliked BOOLEAN DEFAULT false,
    userHasReported BOOLEAN DEFAULT false,

    -- Engagement
    userViewCount INTEGER DEFAULT 0,
    userBookmarkCategory VARCHAR,
    userBookmarkPriority INTEGER,
    isArchived BOOLEAN DEFAULT false,

    -- Denormalized Content Fields
    contentAuthorId UUID,
    contentLatitude DOUBLE PRECISION,
    contentLongitude DOUBLE PRECISION,
    contentLocation GEOMETRY(Point, 4326),

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(momentId, userId)
);

CREATE INDEX idx_reactions_moment ON momentReactions(momentId);
CREATE INDEX idx_reactions_user ON momentReactions(userId);
CREATE INDEX idx_reactions_likes ON momentReactions(momentId, userHasLiked);
```

---

## Key Files & Code Paths

### Backend (maps-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/handlers/moments.ts` | Moment CRUD | `createMoment()`, `getMomentDetails()`, `searchMoments()` |
| `src/store/MomentsStore.ts` | Database queries | `createMoment()`, `searchMoments()`, `findMoments()` |
| `src/store/MediaStore.ts` | Media metadata | `create()`, `getByIds()` |
| `src/handlers/helpers/index.ts` | Utilities | `fetchSignedUrl()`, `checkIsMediaSafeForWork()` |

### Backend (reactions-service)

| File | Purpose |
|------|---------|
| `src/handlers/momentReactions.ts` | Reaction CRUD |
| `src/store/MomentReactionsStore.ts` | Reaction queries |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/routes/EditMoment/` | Create/edit moment screen |
| `main/routes/ViewMoment/` | Moment detail view |
| `main/components/AreaDisplay.tsx` | Moment card in feeds |

---

## API Endpoints: Current

### Moments

```
POST /maps-service/moments
  Body: {
    message, notificationMsg,
    latitude, longitude,        // Required currently
    category, isPublic,
    media: [{path, type}],
    spaceId?, hashTags?, mentionsIds?
  }
  Response: { moment, media }

GET /maps-service/moments/:id
  Query: { withMedia?, withUser? }
  Response: { moment, media?, user? }

PUT /maps-service/moments/:id
  Body: { message?, category?, isPublic?, media? }
  Response: { moment }

DELETE /maps-service/moments/:id
  Response: { success }

GET /maps-service/moments/search
  Query: {
    latitude, longitude,        // Required for geo search
    filterBy?, limit?, offset?
  }
  Response: { moments[], pagination }
```

### Reactions

```
POST /reactions-service/moment-reactions/:momentId
  Body: {
    userHasActivated?, userHasLiked?,
    userHasSuperLiked?, userHasReported?
  }
  Response: { reaction }

GET /reactions-service/moment-reactions/:momentId
  Response: { reactions[], counts }
```

---

## Repurposing for HABITS: Check-ins

### Concept Mapping

| Moments Concept | Check-in Concept | Notes |
|-----------------|------------------|-------|
| Moment | Habit Check-in | Daily completion record |
| `latitude/longitude` | Optional | Not required for habits |
| `message` | `notes` | Optional completion notes |
| `media` | `proofs` | Optional photo/video proof |
| `category` | `habitCategory` | e.g., 'fitness', 'learning' |
| `isPublic` | `shareWithPact` | Share with pact partner |
| `userHasActivated` | `isCompleted` | Repurpose for completion |
| `userHasLiked` | `partnerCelebrated` | Partner encouragement |

### Check-in vs Moment Differences

| Feature | Moment | Check-in |
|---------|--------|----------|
| Location | Required | Optional |
| Geo queries | Primary use case | Not used |
| Expiration | Optional | Daily scope |
| Reactions | Public | Pact-scoped |
| Category | Content type | Habit type |
| Feed | Proximity-based | Timeline/pact-based |

---

## New Schema: Habit Check-ins

### Option A: Extend Moments Table

```sql
-- Make location optional
ALTER TABLE main.moments
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL,
  ALTER COLUMN geom DROP NOT NULL;

-- Add habit-specific fields
ALTER TABLE main.moments ADD COLUMN (
    -- Check-in Context
    contentType VARCHAR(20) DEFAULT 'moment',  -- 'moment' | 'checkin'
    habitGoalId UUID,
    pactId UUID,
    scheduledDate DATE,                         -- Which day this completes

    -- Completion Details
    completionStatus VARCHAR(20),              -- 'completed' | 'partial' | 'skipped'
    completionDuration INTEGER,                -- Minutes spent (optional)
    completionRating INTEGER,                  -- 1-5 self-rating

    -- Streak Impact
    streakContribution BOOLEAN DEFAULT true    -- Did this extend streak?
);

CREATE INDEX idx_moments_contenttype ON moments(contentType);
CREATE INDEX idx_moments_habit ON moments(habitGoalId) WHERE habitGoalId IS NOT NULL;
CREATE INDEX idx_moments_scheduled ON moments(scheduledDate) WHERE scheduledDate IS NOT NULL;
```

### Option B: Separate habit_checkins Table (Recommended)

```sql
CREATE TABLE habits.habit_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    userId UUID NOT NULL REFERENCES users(id),
    habitGoalId UUID NOT NULL REFERENCES habits.habit_goals(id),
    pactId UUID REFERENCES habits.pacts(id),

    -- Scheduling
    scheduledDate DATE NOT NULL,               -- Which day this was for
    completedAt TIMESTAMP,                     -- When user marked complete

    -- Completion
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    durationMinutes INTEGER,
    selfRating INTEGER CHECK (selfRating BETWEEN 1 AND 5),

    -- Proof (Optional)
    proofMedias JSONB,                         -- [{path, type}]
    proofVerified BOOLEAN DEFAULT false,

    -- Location (Optional)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    locationName VARCHAR,

    -- Streak
    streakDayNumber INTEGER,                   -- Which day of streak this is
    contributedToStreak BOOLEAN DEFAULT false,

    -- Visibility
    isSharedWithPact BOOLEAN DEFAULT true,
    isPublic BOOLEAN DEFAULT false,

    -- Timestamps
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(userId, habitGoalId, scheduledDate)  -- One check-in per habit per day
);

CREATE INDEX idx_checkins_user ON habits.habit_checkins(userId);
CREATE INDEX idx_checkins_goal ON habits.habit_checkins(habitGoalId);
CREATE INDEX idx_checkins_pact ON habits.habit_checkins(pactId);
CREATE INDEX idx_checkins_date ON habits.habit_checkins(scheduledDate DESC);
CREATE INDEX idx_checkins_status ON habits.habit_checkins(status);
```

### Check-in Status Enum

```typescript
enum CheckinStatus {
  PENDING = 'pending',       // Scheduled but not completed
  COMPLETED = 'completed',   // Fully done
  PARTIAL = 'partial',       // Partially completed
  SKIPPED = 'skipped',       // Intentionally skipped
  MISSED = 'missed',         // Day passed without action
}
```

---

## New API Endpoints

### Check-in Management

```
POST /habits-service/checkins
  Body: {
    habitGoalId: string,
    pactId?: string,
    scheduledDate?: string,     // Defaults to today
    status: 'completed' | 'partial' | 'skipped',
    notes?: string,
    durationMinutes?: number,
    selfRating?: 1-5,
    proofMedias?: [{path, type}],
    latitude?: number,
    longitude?: number,
    locationName?: string
  }
  Response: {
    checkin,
    streakUpdate: { before, after, isNewRecord },
    achievementsUnlocked: string[]
  }

GET /habits-service/checkins
  Query: {
    habitGoalId?, pactId?,
    startDate?, endDate?,
    status?,
    limit?, offset?
  }
  Response: { checkins[], pagination }

GET /habits-service/checkins/:id
  Response: { checkin, habitGoal, pact?, user }

PUT /habits-service/checkins/:id
  Body: { notes?, selfRating?, proofMedias? }
  Response: { checkin }

DELETE /habits-service/checkins/:id
  Response: { success, streakUpdate }
```

### Check-in Feed

```
GET /habits-service/checkins/feed
  Query: {
    pactId?,                    // Filter to specific pact
    type: 'mine' | 'pact' | 'all',
    limit?, offset?
  }
  Response: {
    checkins: [{
      checkin,
      user: { id, userName, media },
      habitGoal: { name, category },
      reactions: { celebrationCount }
    }]
  }

GET /habits-service/checkins/calendar
  Query: {
    habitGoalId,
    month: 'YYYY-MM'
  }
  Response: {
    days: {
      '2025-01-15': { status: 'completed', streakDay: 7 },
      '2025-01-16': { status: 'pending' },
      ...
    }
  }
```

### Check-in Reactions

```
POST /habits-service/checkins/:id/celebrate
  Body: { message?: string }
  Response: { celebration }

GET /habits-service/checkins/:id/celebrations
  Response: { celebrations: [{ user, message, createdAt }] }
```

---

## Feed Query Changes

### Current: Geospatial Feed

```typescript
// MomentsStore.ts - Current searchMoments
const searchMoments = async ({
  latitude,      // Required
  longitude,     // Required
  limit,
  offset,
}) => {
  return knex('moments')
    .select('*')
    .whereRaw(`
      ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
        ?
      )
    `, [longitude, latitude, distanceMeters])
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset(offset);
};
```

### New: Timeline Feed

```typescript
// HabitCheckinsStore.ts - Timeline-based
const getCheckinsFeed = async ({
  userId,
  pactId,
  startDate,
  endDate,
  limit,
  offset,
}) => {
  let query = knex('habit_checkins as c')
    .join('habit_goals as g', 'c.habitGoalId', 'g.id')
    .join('users as u', 'c.userId', 'u.id')
    .select([
      'c.*',
      'g.name as habitName',
      'g.category as habitCategory',
      'u.userName',
      'u.media as userMedia',
    ])
    .where('c.status', '!=', 'pending');

  if (pactId) {
    query = query.where('c.pactId', pactId);
  }

  if (startDate) {
    query = query.where('c.scheduledDate', '>=', startDate);
  }

  if (endDate) {
    query = query.where('c.scheduledDate', '<=', endDate);
  }

  return query
    .orderBy('c.completedAt', 'desc')
    .limit(limit)
    .offset(offset);
};
```

---

## Content Safety

### Existing Sightengine Integration

```typescript
// handlers/helpers/index.ts
const checkIsMediaSafeForWork = async (signedUrl: string): Promise<boolean> => {
  const response = await axios.get('https://api.sightengine.com/1.0/check-workflow.json', {
    params: {
      url: signedUrl,
      workflow: process.env.SIGHTENGINE_WORKFLOW_ID,
      api_user: process.env.SIGHTENGINE_API_KEY,
      api_secret: process.env.SIGHTENGINE_API_SECRET,
    },
  });

  return response.data?.summary?.action === 'accept';
};
```

**Reuse for HABITS:**
- Same API call for proof photo verification
- Flag unsafe content automatically
- Queue for manual review if flagged

---

## Mobile Components

### Check-in Button

```typescript
// TherrMobile/main/components/CheckinButton.tsx
const CheckinButton = ({ habitGoal, pact, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckin = async () => {
    setIsLoading(true);
    try {
      const result = await HabitsService.createCheckin({
        habitGoalId: habitGoal.id,
        pactId: pact?.id,
        status: 'completed',
      });

      if (result.achievementsUnlocked.length > 0) {
        showAchievementCelebration(result.achievementsUnlocked);
      }

      if (result.streakUpdate.isNewRecord) {
        showNewRecordAnimation();
      }

      onComplete(result);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleCheckin}
      disabled={isLoading}
    >
      <Text>Complete Today</Text>
    </TouchableOpacity>
  );
};
```

### Check-in Detail Modal

```typescript
// TherrMobile/main/components/CheckinDetailModal.tsx
const CheckinDetailModal = ({ visible, habitGoal, pact, onSubmit, onClose }) => {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number>();
  const [rating, setRating] = useState<number>();
  const [proofPhoto, setProofPhoto] = useState<string>();

  return (
    <Modal visible={visible}>
      <View style={styles.container}>
        <Text style={styles.title}>Complete: {habitGoal.name}</Text>

        <TextInput
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.row}>
          <Text>Duration:</Text>
          <DurationPicker value={duration} onChange={setDuration} />
        </View>

        <View style={styles.row}>
          <Text>How did it go?</Text>
          <StarRating value={rating} onChange={setRating} />
        </View>

        <TouchableOpacity onPress={pickPhoto}>
          <Text>Add Proof Photo (optional)</Text>
        </TouchableOpacity>

        {proofPhoto && <Image source={{ uri: proofPhoto }} />}

        <Button
          title="Complete"
          onPress={() => onSubmit({ notes, duration, rating, proofPhoto })}
        />
      </View>
    </Modal>
  );
};
```

### Calendar Heat Map

```typescript
// TherrMobile/main/components/HabitCalendar.tsx
const HabitCalendar = ({ habitGoalId, month }) => {
  const [calendarData, setCalendarData] = useState({});

  useEffect(() => {
    HabitsService.getCheckinCalendar(habitGoalId, month)
      .then(data => setCalendarData(data.days));
  }, [habitGoalId, month]);

  return (
    <CalendarList
      markingType="custom"
      markedDates={Object.entries(calendarData).reduce((acc, [date, data]) => {
        acc[date] = {
          customStyles: {
            container: {
              backgroundColor: getColorForStatus(data.status),
            },
            text: {
              color: 'white',
            },
          },
        };
        return acc;
      }, {})}
    />
  );
};

const getColorForStatus = (status: string) => {
  switch (status) {
    case 'completed': return '#4CAF50';  // Green
    case 'partial': return '#FFC107';    // Yellow
    case 'skipped': return '#9E9E9E';    // Gray
    case 'missed': return '#F44336';     // Red
    default: return 'transparent';
  }
};
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create `habits.habit_checkins` table migration
- [ ] Add indexes for efficient queries
- [ ] Create check-in status enum type

### Phase 2: Backend Store
- [ ] Create `src/store/HabitCheckinsStore.ts`
- [ ] Implement `createCheckin()` with streak integration
- [ ] Implement `getCheckinsFeed()` timeline query
- [ ] Implement `getCalendarData()` for heat map

### Phase 3: Backend Handlers
- [ ] Create `src/handlers/habitCheckins.ts`
- [ ] Integrate streak update on check-in
- [ ] Integrate achievement check on check-in
- [ ] Add proof media handling

### Phase 4: API Routes
- [ ] Add check-in routes to router
- [ ] Add feed endpoint
- [ ] Add calendar endpoint
- [ ] Add celebration endpoint

### Phase 5: Mobile Screens
- [ ] Create `CheckinButton` component
- [ ] Create `CheckinDetailModal` component
- [ ] Create `HabitCalendar` heat map
- [ ] Create check-in feed view
- [ ] Add check-in to habit detail screen

### Phase 6: Notifications
- [ ] Trigger partner notification on check-in
- [ ] Trigger celebration notification on partner's check-in
- [ ] Trigger streak milestone notification

---

## Migration Strategy

### For MVP

1. Create new `habit_checkins` table (don't modify moments)
2. Reuse media upload infrastructure as-is
3. Create new service/handlers for check-ins
4. Separate feed from moments feed entirely

### Long-term

Consider whether to:
- Merge check-ins into unified content table
- Share more infrastructure with moments
- Add location-optional moments for non-habits use cases
