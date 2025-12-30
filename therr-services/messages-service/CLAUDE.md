# Claude Code Instructions - Messages Service

## Service Overview

- **Port**: 7772
- **Database**: `therr_dev_messages`
- **Purpose**: Direct messaging and forum discussions

## Key Domains

- **Direct Messages**: Private user-to-user messaging
- **Forums**: Group discussion boards
- **Forum Messages**: Messages within forums
- **App Logging**: Client-side log collection

## Directory Structure

```
src/
├── handlers/       # Business logic
│   ├── directMessages.ts
│   ├── forums.ts
│   └── forumMessages.ts
├── routes/         # Express routers
├── store/          # Data access
│   ├── DirectMessagesStore.ts
│   ├── ForumsStore.ts
│   └── ForumMessagesStore.ts
├── api/            # External service calls
│   └── usersService.ts
└── utilities/      # Content safety, error handling
```

## Key Patterns

### Message Storage
- Direct messages stored with sender/receiver IDs
- Forum messages linked to forum and category
- Content safety checks before storage

### Content Moderation
- Uses `utilities/contentSafety.ts` for filtering
- Bad word detection and filtering

## Database Tables (main schema)

Key tables: `directMessages`, `forums`, `forumMessages`, `forumCategories`, `categories`

## Related Services

- Called by: api-gateway, websocket-service
- Calls: users-service (for user lookups)
