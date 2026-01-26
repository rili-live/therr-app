# HABITS Real-Time Design

## Executive Summary

The Therr WebSocket system uses Socket.IO with Redis adapter for real-time communication. It handles presence, messaging, and live updates. For HABITS, we create pact-specific rooms and real-time activity feeds showing partner check-ins, celebrations, and milestones.

**Reuse Level**: 85% - Full infrastructure reusable, add pact-specific events

---

## Current Implementation

### Architecture Overview

```
Mobile App
    ↓
Socket.IO Client (socket.io-client)
    ↓
API Gateway (proxies to websocket-service)
    ↓
WebSocket Service (port 7743)
    ↓
Redis Adapter (horizontal scaling)
    ↓
Redis Session Store (presence tracking)
```

### Socket.IO Configuration

```typescript
// websocket-service/src/index.ts
const io = new Server(server, {
  path: '/socketio',
  adapter: createAdapter(redisClient, redisSub),
  pingTimeout: 30000,
  pingInterval: 25000,
});
```

### Room System

```
Room Pattern: FORUM:{forumId}
Example: FORUM:abc123-def456
```

Rooms are used for group messaging. Users join rooms, and messages broadcast to all room members.

---

## Key Files & Code Paths

### Backend (websocket-service)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/index.ts` | Server setup | Socket.IO initialization |
| `src/handlers/auth.ts` | Login/logout | `login()`, `logout()` |
| `src/handlers/rooms.ts` | Room management | `joinRoom()`, `leaveRoom()` |
| `src/handlers/messages.ts` | Messaging | `sendDirectMessage()`, `sendForumMessage()` |
| `src/handlers/userConnections.ts` | Connection events | `createConnection()`, `updateConnection()` |
| `src/handlers/reactions.ts` | Reaction events | `createOrUpdateReaction()` |
| `src/store/redisSessions.ts` | Presence | Session CRUD |

### Mobile (TherrMobile)

| File | Purpose |
|------|---------|
| `main/socket-io-middleware.ts` | Redux-Socket.IO bridge |
| `main/components/Layout.tsx` | Event handlers, navigation |

### Shared Library (therr-js-utilities)

| File | Purpose |
|------|---------|
| `src/constants/enums/SocketClientActionTypes.ts` | Client → Server events |
| `src/constants/enums/SocketServerActionTypes.ts` | Server → Client events |

---

## Current Event Types

### Client → Server (SocketClientActionTypes)

```typescript
enum SocketClientActionTypes {
  LOGIN = 'CLIENT:LOGIN',
  LOGOUT = 'CLIENT:LOGOUT',
  UPDATE_SESSION = 'CLIENT:UPDATE_SESSION',
  JOIN_ROOM = 'CLIENT:JOIN_ROOM',
  EXIT_ROOM = 'CLIENT:EXIT_ROOM',
  SEND_DIRECT_MESSAGE = 'CLIENT:SEND_DIRECT_MESSAGE',
  SEND_MESSAGE = 'CLIENT:SEND_MESSAGE',
  UPDATE_NOTIFICATION = 'CLIENT:UPDATE_NOTIFICATION',
  LOAD_ACTIVE_CONNECTIONS = 'CLIENT:LOAD_ACTIVE_CONNECTIONS',
  CREATE_USER_CONNECTION = 'CLIENT:CREATE_USER_CONNECTION',
  UPDATE_USER_CONNECTION = 'CLIENT:UPDATE_USER_CONNECTION',
  CREATE_OR_UPDATE_REACTION = 'CLIENT:CREATE_OR_UPDATE_REACTION',
}
```

### Server → Client (SocketServerActionTypes)

```typescript
enum SocketServerActionTypes {
  SESSION_CREATED = 'SERVER:SESSION_CREATED',
  SESSION_UPDATED = 'SERVER:SESSION_UPDATED',
  SESSION_CLOSED = 'SERVER:SESSION_CLOSED',
  USER_LOGIN_SUCCESS = 'SERVER:USER_LOGIN_SUCCESS',
  USER_LOGOUT_SUCCESS = 'SERVER:USER_LOGOUT_SUCCESS',
  JOINED_ROOM = 'SERVER:JOINED_ROOM',
  LEFT_ROOM = 'SERVER:LEFT_ROOM',
  OTHER_JOINED_ROOM = 'SERVER:OTHER_JOINED_ROOM',
  SEND_MESSAGE = 'SERVER:SEND_MESSAGE',
  SEND_DIRECT_MESSAGE = 'SERVER:SEND_DIRECT_MESSAGE',
  NOTIFICATION_CREATED = 'SERVER:NOTIFICATION_CREATED',
  NOTIFICATION_UPDATED = 'SERVER:NOTIFICATION_UPDATED',
  ACTIVE_CONNECTIONS_LOADED = 'SERVER:ACTIVE_CONNECTIONS_LOADED',
  ACTIVE_CONNECTIONS_ADDED = 'SERVER:ACTIVE_CONNECTIONS_ADDED',
  ACTIVE_CONNECTION_LOGGED_IN = 'SERVER:ACTIVE_CONNECTION_LOGGED_IN',
  ACTIVE_CONNECTION_LOGGED_OUT = 'SERVER:ACTIVE_CONNECTION_LOGGED_OUT',
  ACTIVE_CONNECTION_DISCONNECTED = 'SERVER:ACTIVE_CONNECTION_DISCONNECTED',
  ACTIVE_CONNECTION_REFRESHED = 'SERVER:ACTIVE_CONNECTION_REFRESHED',
  USER_CONNECTION_CREATED = 'SERVER:USER_CONNECTION_CREATED',
  USER_CONNECTION_UPDATED = 'SERVER:USER_CONNECTION_UPDATED',
  SEND_ROOMS_LIST = 'SERVER:SEND_ROOMS_LIST',
}
```

---

## Redux-Socket.IO Middleware

### Mobile Integration

```typescript
// TherrMobile/main/socket-io-middleware.ts
const createSocketMiddleware = () => {
  const socket = io(SOCKET_URL, {
    path: '/socketio',
    autoConnect: false,
    secure: true,
    query: {
      platform: 'mobile',
      brandVariation: BRAND_VARIATION,
    },
  });

  return (store) => (next) => (action) => {
    // Intercept actions prefixed with WEB_CLIENT_PREFIX
    if (action.type.startsWith('WEB_CLIENT_PREFIX:CLIENT:')) {
      const socketAction = action.type.replace('WEB_CLIENT_PREFIX:', '');
      socket.emit('action', {
        type: socketAction,
        data: action.data,
      });
    }

    return next(action);
  };
};
```

### Flow Diagram

```
Redux Action: WEB_CLIENT_PREFIX:CLIENT:SEND_MESSAGE
    ↓
Middleware intercepts
    ↓
Socket.emit('action', { type: 'CLIENT:SEND_MESSAGE', data })
    ↓
WebSocket Service handler
    ↓
Handler processes, calls HTTP APIs
    ↓
Socket.emit('action', { type: 'SERVER:SEND_MESSAGE', data })
    ↓
Mobile receives, dispatches to Redux
    ↓
Reducer updates state
    ↓
UI re-renders
```

---

## Redis Session Management

### Session Structure

```typescript
interface IUserSocketSession {
  app: string;              // 'therrChat'
  socketId: string;
  ip: string;
  ttl: number;              // 30 minutes
  data: {
    id: string;             // User ID
    socketId: string;
    previousSocketId?: string;
    userName: string;
    firstName: string;
    lastName: string;
    idToken: string;
    status: UserStatus;     // ACTIVE, AWAY, OFFLINE
  }
}
```

### Presence Tracking

```typescript
// Check if user is online
const isOnline = await redisClient.exists(`session:${userId}`);

// Get user's socket ID
const session = await redisClient.hGetAll(`session:${userId}`);
const socketId = session.socketId;

// Emit to specific user
io.to(socketId).emit('action', { type, data });
```

---

## Repurposing for HABITS: Pact Activity

### New Room System

```
Room Pattern: PACT:{pactId}
Example: PACT:abc123-def456
```

Each pact gets its own room. Both pact members join the room to receive real-time updates.

### New Event Types

#### Client → Server

```typescript
// Add to SocketClientActionTypes
enum HabitClientActionTypes {
  JOIN_PACT = 'CLIENT:JOIN_PACT',
  LEAVE_PACT = 'CLIENT:LEAVE_PACT',
  LOG_CHECKIN = 'CLIENT:LOG_CHECKIN',
  SEND_CELEBRATION = 'CLIENT:SEND_CELEBRATION',
  SEND_ENCOURAGEMENT = 'CLIENT:SEND_ENCOURAGEMENT',
}
```

#### Server → Client

```typescript
// Add to SocketServerActionTypes
enum HabitServerActionTypes {
  JOINED_PACT = 'SERVER:JOINED_PACT',
  LEFT_PACT = 'SERVER:LEFT_PACT',
  PARTNER_JOINED_PACT = 'SERVER:PARTNER_JOINED_PACT',
  PARTNER_LEFT_PACT = 'SERVER:PARTNER_LEFT_PACT',
  CHECKIN_LOGGED = 'SERVER:CHECKIN_LOGGED',
  PARTNER_CHECKED_IN = 'SERVER:PARTNER_CHECKED_IN',
  CELEBRATION_RECEIVED = 'SERVER:CELEBRATION_RECEIVED',
  ENCOURAGEMENT_RECEIVED = 'SERVER:ENCOURAGEMENT_RECEIVED',
  STREAK_MILESTONE = 'SERVER:STREAK_MILESTONE',
  PACT_ACTIVITY = 'SERVER:PACT_ACTIVITY',  // Generic activity event
}
```

---

## New Handler Implementations

### Pact Rooms Handler

```typescript
// websocket-service/src/handlers/pacts.ts

const joinPact = async (
  config: IInternalConfig,
  socket: Socket,
  data: { pactId: string },
  decodedToken: IDecodedToken
) => {
  const { pactId } = data;
  const roomName = `PACT:${pactId}`;

  // Validate user is pact member
  const pact = await PactsStore.findById(pactId);
  const isMember = pact.creatorUserId === decodedToken.id ||
                   pact.partnerUserId === decodedToken.id;

  if (!isMember) {
    socket.emit('action', {
      type: SocketServerActionTypes.ERROR,
      data: { message: 'Not a pact member' },
    });
    return;
  }

  // Join room
  socket.join(roomName);

  // Notify joining user
  socket.emit('action', {
    type: HabitServerActionTypes.JOINED_PACT,
    data: { pactId, pact },
  });

  // Notify partner (if online)
  socket.to(roomName).emit('action', {
    type: HabitServerActionTypes.PARTNER_JOINED_PACT,
    data: {
      pactId,
      userId: decodedToken.id,
      userName: decodedToken.userName,
    },
  });
};

const leavePact = async (
  config: IInternalConfig,
  socket: Socket,
  data: { pactId: string },
  decodedToken: IDecodedToken
) => {
  const roomName = `PACT:${data.pactId}`;

  // Notify partner before leaving
  socket.to(roomName).emit('action', {
    type: HabitServerActionTypes.PARTNER_LEFT_PACT,
    data: {
      pactId: data.pactId,
      userId: decodedToken.id,
    },
  });

  // Leave room
  socket.leave(roomName);

  // Confirm to leaving user
  socket.emit('action', {
    type: HabitServerActionTypes.LEFT_PACT,
    data: { pactId: data.pactId },
  });
};
```

### Check-in Handler

```typescript
const logCheckin = async (
  config: IInternalConfig,
  socket: Socket,
  data: {
    pactId: string;
    habitGoalId: string;
    status: 'completed' | 'partial' | 'skipped';
    notes?: string;
    proofMedia?: object[];
  },
  decodedToken: IDecodedToken
) => {
  const { pactId, habitGoalId, status, notes, proofMedia } = data;

  // 1. Create check-in via HTTP to habits-service
  const checkin = await axios.post(`${HABITS_SERVICE_URL}/checkins`, {
    userId: decodedToken.id,
    habitGoalId,
    pactId,
    status,
    notes,
    proofMedia,
  });

  // 2. Emit to self
  socket.emit('action', {
    type: HabitServerActionTypes.CHECKIN_LOGGED,
    data: {
      checkin: checkin.data,
      streakUpdate: checkin.data.streakUpdate,
      achievementsUnlocked: checkin.data.achievementsUnlocked,
    },
  });

  // 3. Emit to partner (pact room)
  const roomName = `PACT:${pactId}`;
  socket.to(roomName).emit('action', {
    type: HabitServerActionTypes.PARTNER_CHECKED_IN,
    data: {
      pactId,
      userId: decodedToken.id,
      userName: decodedToken.userName,
      checkin: checkin.data,
      habitName: checkin.data.habitGoal.name,
    },
  });

  // 4. Check for streak milestone
  if (checkin.data.streakUpdate?.isNewRecord) {
    socket.emit('action', {
      type: HabitServerActionTypes.STREAK_MILESTONE,
      data: {
        streakDays: checkin.data.streakUpdate.after,
        habitGoalId,
        isNewRecord: true,
      },
    });
  }
};
```

### Celebration Handler

```typescript
const sendCelebration = async (
  config: IInternalConfig,
  socket: Socket,
  data: {
    pactId: string;
    targetUserId: string;
    checkinId: string;
    message?: string;
  },
  decodedToken: IDecodedToken
) => {
  const { pactId, targetUserId, checkinId, message } = data;

  // 1. Store celebration
  const celebration = await CelebrationsStore.create({
    fromUserId: decodedToken.id,
    toUserId: targetUserId,
    checkinId,
    message,
  });

  // 2. Emit to target user via pact room
  const roomName = `PACT:${pactId}`;
  socket.to(roomName).emit('action', {
    type: HabitServerActionTypes.CELEBRATION_RECEIVED,
    data: {
      celebration,
      fromUserName: decodedToken.userName,
      message,
    },
  });

  // 3. Send push notification if offline
  const targetSession = await redisSessions.getUserById(targetUserId);
  if (!targetSession) {
    await sendPushNotification({
      userId: targetUserId,
      type: PushNotifications.partnerCelebrated,
      data: { fromUserName: decodedToken.userName },
    });
  }
};
```

---

## Pact Activity Feed

### Activity Event Structure

```typescript
interface IPactActivity {
  id: string;
  pactId: string;
  type: PactActivityType;
  userId: string;
  data: object;
  createdAt: Date;
}

enum PactActivityType {
  CHECKIN_COMPLETED = 'checkin_completed',
  CHECKIN_SKIPPED = 'checkin_skipped',
  CELEBRATION_SENT = 'celebration_sent',
  ENCOURAGEMENT_SENT = 'encouragement_sent',
  STREAK_MILESTONE = 'streak_milestone',
  STREAK_BROKEN = 'streak_broken',
  PARTNER_JOINED = 'partner_joined',
  PACT_STARTED = 'pact_started',
  PACT_COMPLETED = 'pact_completed',
}
```

### Broadcasting Activity Events

```typescript
// Helper function for activity broadcast
const broadcastPactActivity = async (
  io: Server,
  pactId: string,
  activity: IPactActivity
) => {
  const roomName = `PACT:${pactId}`;

  // Store activity for feed history
  await PactActivitiesStore.create(activity);

  // Broadcast to pact room
  io.to(roomName).emit('action', {
    type: HabitServerActionTypes.PACT_ACTIVITY,
    data: activity,
  });
};
```

---

## Mobile Redux Integration

### Pact State

```typescript
// Redux state structure
interface IPactState {
  activePacts: IPact[];
  currentPact: IPact | null;
  pactActivities: {
    [pactId: string]: IPactActivity[];
  };
  partnerPresence: {
    [pactId: string]: {
      isOnline: boolean;
      lastSeen: Date;
    };
  };
}
```

### Reducer for Pact Events

```typescript
// TherrMobile/main/redux/reducers/pacts.ts

const initialState: IPactState = {
  activePacts: [],
  currentPact: null,
  pactActivities: {},
  partnerPresence: {},
};

export default (state = initialState, action) => {
  switch (action.type) {
    case HabitServerActionTypes.JOINED_PACT:
      return {
        ...state,
        currentPact: action.data.pact,
        pactActivities: {
          ...state.pactActivities,
          [action.data.pactId]: [],
        },
      };

    case HabitServerActionTypes.PARTNER_CHECKED_IN:
      return {
        ...state,
        pactActivities: {
          ...state.pactActivities,
          [action.data.pactId]: [
            {
              type: PactActivityType.CHECKIN_COMPLETED,
              userId: action.data.userId,
              data: action.data.checkin,
              createdAt: new Date(),
            },
            ...state.pactActivities[action.data.pactId] || [],
          ],
        },
      };

    case HabitServerActionTypes.CELEBRATION_RECEIVED:
      // Show celebration animation
      return {
        ...state,
        pactActivities: {
          ...state.pactActivities,
          [action.data.celebration.pactId]: [
            {
              type: PactActivityType.CELEBRATION_SENT,
              userId: action.data.celebration.fromUserId,
              data: action.data,
              createdAt: new Date(),
            },
            ...state.pactActivities[action.data.celebration.pactId] || [],
          ],
        },
      };

    case HabitServerActionTypes.PARTNER_JOINED_PACT:
      return {
        ...state,
        partnerPresence: {
          ...state.partnerPresence,
          [action.data.pactId]: {
            isOnline: true,
            lastSeen: new Date(),
          },
        },
      };

    case HabitServerActionTypes.PARTNER_LEFT_PACT:
      return {
        ...state,
        partnerPresence: {
          ...state.partnerPresence,
          [action.data.pactId]: {
            isOnline: false,
            lastSeen: new Date(),
          },
        },
      };

    default:
      return state;
  }
};
```

---

## Mobile UI Components

### Pact Activity Feed

```typescript
// TherrMobile/main/routes/Pacts/ActivityFeed.tsx

const PactActivityFeed = ({ pactId }) => {
  const activities = useSelector(state => state.pacts.pactActivities[pactId] || []);

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ActivityItem activity={item} />}
      inverted  // Latest at bottom
      ListEmptyComponent={<EmptyState text="No activity yet" />}
    />
  );
};

const ActivityItem = ({ activity }) => {
  const { type, userId, data, createdAt } = activity;

  switch (type) {
    case PactActivityType.CHECKIN_COMPLETED:
      return (
        <View style={styles.item}>
          <UserAvatar userId={userId} />
          <View>
            <Text>{data.userName} completed {data.habitName}</Text>
            {data.notes && <Text style={styles.notes}>{data.notes}</Text>}
            <Text style={styles.time}>{formatTime(createdAt)}</Text>
          </View>
        </View>
      );

    case PactActivityType.CELEBRATION_SENT:
      return (
        <View style={[styles.item, styles.celebration]}>
          <CelebrationIcon />
          <Text>{data.fromUserName} sent a celebration!</Text>
        </View>
      );

    case PactActivityType.STREAK_MILESTONE:
      return (
        <View style={[styles.item, styles.milestone]}>
          <FireIcon />
          <Text>{data.userName} hit a {data.streakDays}-day streak!</Text>
        </View>
      );

    default:
      return null;
  }
};
```

### Partner Presence Indicator

```typescript
// TherrMobile/main/components/PartnerPresence.tsx

const PartnerPresence = ({ pactId, partnerId }) => {
  const presence = useSelector(state => state.pacts.partnerPresence[pactId]);

  if (presence?.isOnline) {
    return (
      <View style={styles.container}>
        <View style={styles.onlineDot} />
        <Text>Online</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.offlineDot} />
      <Text>Last seen {formatRelativeTime(presence?.lastSeen)}</Text>
    </View>
  );
};
```

---

## Implementation Checklist

### Phase 1: Backend Events
- [ ] Add habit event types to `SocketClientActionTypes`
- [ ] Add habit event types to `SocketServerActionTypes`
- [ ] Create `src/handlers/pacts.ts` with join/leave handlers

### Phase 2: Backend Check-in Integration
- [ ] Create `logCheckin` handler
- [ ] Create `sendCelebration` handler
- [ ] Create `sendEncouragement` handler
- [ ] Integrate with habits-service HTTP endpoints

### Phase 3: Activity Feed Backend
- [ ] Create `pact_activities` table
- [ ] Create `PactActivitiesStore`
- [ ] Implement `broadcastPactActivity` helper
- [ ] Store activities on all events

### Phase 4: Mobile Redux
- [ ] Add pacts reducer with activity state
- [ ] Add event handlers to socket middleware
- [ ] Connect to Redux store

### Phase 5: Mobile UI
- [ ] Create `PactActivityFeed` component
- [ ] Create `ActivityItem` component
- [ ] Create `PartnerPresence` indicator
- [ ] Add celebration animation
- [ ] Add milestone animation

### Phase 6: Auto-Join on App Load
- [ ] Join all active pact rooms on socket connect
- [ ] Re-join rooms on reconnect
- [ ] Leave rooms on disconnect

---

## Socket Event Flow Examples

### Check-in Flow

```
User A opens pact screen
    ↓
CLIENT:JOIN_PACT { pactId }
    ↓
SERVER:JOINED_PACT { pact }
(User A's UI updates)
    ↓
User A taps "Complete"
    ↓
CLIENT:LOG_CHECKIN { pactId, habitGoalId, status }
    ↓
Handler calls habits-service HTTP API
    ↓
SERVER:CHECKIN_LOGGED → User A
    ↓
SERVER:PARTNER_CHECKED_IN → Pact room (User B)
    ↓
User B's activity feed updates in real-time
    ↓
User B taps "Celebrate"
    ↓
CLIENT:SEND_CELEBRATION { pactId, targetUserId }
    ↓
SERVER:CELEBRATION_RECEIVED → User A
    ↓
User A sees celebration animation
```

### Partner Goes Online

```
User B connects to socket
    ↓
CLIENT:LOGIN
    ↓
Auto-join all active pact rooms
    ↓
CLIENT:JOIN_PACT { pactId } (for each pact)
    ↓
SERVER:PARTNER_JOINED_PACT → Pact room (User A)
    ↓
User A sees "Partner is online" indicator
```
