# Claude Code Instructions - WebSocket Service

## Service Overview

- **Port**: 7743
- **Database**: None (uses Redis for sessions)
- **Purpose**: Real-time bidirectional communication via Socket.IO

## Key Domains

- **Auth**: Socket authentication and session management
- **Messages**: Real-time message delivery
- **Notifications**: Live notification push
- **Reactions**: Real-time reaction updates
- **Rooms**: Socket room management
- **User Connections**: Online presence tracking

## Directory Structure

```
src/
├── handlers/           # Socket event handlers
│   ├── auth.ts         # Authentication events
│   ├── messages.ts     # Message events
│   ├── notifications.ts
│   ├── reactions.ts
│   ├── rooms.ts
│   ├── sessions.ts
│   └── userConnections.ts
├── store/
│   ├── redisAdapter.ts # Socket.IO Redis adapter
│   └── redisSessions.ts # Session storage
├── utilities/
│   ├── authenticate.ts # JWT validation
│   └── notify-connections.ts
└── constants/
    └── socket/DisconnectReason.ts
```

## Key Patterns

### Socket.IO with Redis Adapter
- Uses `socket.io-redis` for horizontal scaling
- Sessions stored in Redis for persistence across restarts
- Configured in `store/redisAdapter.ts`

### Event Types
Socket events follow Redux action pattern:
- Event names map to `SocketClientActionTypes` from therr-js-utilities
- Handlers emit corresponding server action types

### Session Management
- `redisSessions.ts` - stores user socket sessions
- Tracks which users are online
- Used for presence features

### Authentication Flow
1. Client connects with JWT in handshake
2. `utilities/authenticate.ts` validates token
3. Session created in Redis
4. User joins appropriate rooms

## Client Path

Socket.IO client connects to: `/socketio`

## Related Services

- Called directly by clients (mobile app, web)
- Calls: messages-service, users-service (via HTTP for data)

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
