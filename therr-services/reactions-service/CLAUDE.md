# Claude Code Instructions - Reactions Service

## Service Overview

- **Port**: 7774
- **Database**: `therr_dev_reactions`
- **Purpose**: Content engagement - likes, views, ratings, bookmarks

## Key Domains

- **Moment Reactions**: Engagement with moments
- **Space Reactions**: Engagement with spaces (check-ins, ratings)
- **Event Reactions**: Engagement with events
- **Thought Reactions**: Engagement with thoughts

## Directory Structure

```
src/
├── handlers/       # Business logic per content type
│   ├── momentReactions.ts
│   ├── spaceReactions.ts
│   ├── eventReactions.ts
│   └── thoughtReactions.ts
├── routes/         # Express routers (one per content type)
├── store/          # Data access
│   ├── MomentReactionsStore.ts
│   ├── SpaceReactionsStore.ts
│   ├── EventReactionsStore.ts
│   └── ThoughtReactionsStore.ts
└── utilities/      # Reaction valuation, achievements
```

## Key Patterns

### Reaction Types
Standard reaction types across all content:
- `like` / `dislike`
- `view` / `impression`
- `bookmark`
- `report`
- For spaces: `rating` (1-5), `check-in`

### Reaction Valuation
- `utilities/getReactionValuation.ts` - calculates engagement value
- Used for analytics and recommendation algorithms

### Achievement Updates
- `utilities/updateAchievements.ts` - triggers achievement updates
- Cross-service call to users-service

### Coin Rewards
- `utilities/sendUserCoinUpdateRequest.ts` - rewards users for engagement
- Gamification integration with users-service

## Database Tables (main schema)

Key tables: `momentReactions`, `spaceReactions`, `eventReactions`, `thoughtReactions`

Each has: userId, contentId, reactionType, createdAt, updatedAt

## Related Services

- Called by: api-gateway, maps-service
- Calls: users-service (for coin updates, achievements)

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
