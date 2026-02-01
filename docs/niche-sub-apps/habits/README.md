# HABITS App - Feature Repurposing Documentation

This directory contains detailed documentation for repurposing existing Therr App features for the "Friends With Habits" accountability-based habit tracker.

## Purpose

These documents serve as starting points for future Claude agents to implement code changes. Each document details:
- How the existing Therr feature works
- Database schemas and key files
- What needs to change for HABITS
- Proposed new schemas and endpoints
- Implementation checklists

## Document Index

| Document | Therr Feature | HABITS Feature | Priority |
|----------|--------------|----------------|----------|
| [HABITS_AUTH_REPURPOSING.md](./HABITS_AUTH_REPURPOSING.md) | User Authentication & Profiles | Streamlined Auth & Habit Profiles | High |
| [HABITS_PACTS_SCHEMA.md](./HABITS_PACTS_SCHEMA.md) | Social Connections | Pacts (Accountability Partnerships) | High |
| [HABITS_STREAKS_DESIGN.md](./HABITS_STREAKS_DESIGN.md) | Rewards/Points System | Streak Tracking & Achievements | High |
| [HABITS_CHECKINS_DESIGN.md](./HABITS_CHECKINS_DESIGN.md) | Moments (Location Check-ins) | Habit Check-ins (No Location) | High |
| [HABITS_NOTIFICATIONS_DESIGN.md](./HABITS_NOTIFICATIONS_DESIGN.md) | Push Notifications | Habit Reminders & Partner Alerts | High |
| [HABITS_REALTIME_DESIGN.md](./HABITS_REALTIME_DESIGN.md) | WebSocket & Activity Feed | Pact Activity Feed | Medium |
| [HABITS_MEDIA_DESIGN.md](./HABITS_MEDIA_DESIGN.md) | Media Uploads | Proof Uploads (Photo/Video) | Medium |
| [HABITS_GROUPS_DESIGN.md](./HABITS_GROUPS_DESIGN.md) | Groups | Pact Management | Medium |

## Quick Reference: Infrastructure Reuse

### Fully Reusable (No Changes)
- OAuth authentication (Google, Apple, Facebook)
- JWT token handling
- Password hashing (bcrypt)
- Email verification flow
- Push notification delivery (FCM)
- Media upload signed URLs (GCS)
- Socket.IO real-time infrastructure

### Needs Modification
- User profile fields (hide location, add habit preferences)
- Connections → Pacts (add pact-specific fields)
- Moments → Check-ins (make location optional)
- Achievements → Streaks (add streak tracking logic)
- Groups → Pact management (simplify roles)

### New Components Needed
- Habits service or extension to maps-service
- Pact goals table
- Habit check-ins table
- Streak calculation logic
- Proof verification workflow
- Scheduled notification system

## Related Documentation

- [HABITS_PROJECT_BRIEF.md](../HABITS_PROJECT_BRIEF.md) - Full project brief and roadmap
- [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) - Core Therr App context
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture overview

## Implementation Order

Recommended order for implementing features:

1. **Phase 1: Core Infrastructure**
   - Authentication (minimal changes)
   - Pacts schema (extends connections)
   - Basic check-ins (simplified moments)

2. **Phase 2: Engagement**
   - Streaks and achievements
   - Push notifications for habits
   - Proof uploads

3. **Phase 3: Real-time & Social**
   - Pact activity feed
   - Real-time partner updates
   - Pact management UI

## Key Principles

From the project brief:
- **Mandatory Social**: Users CANNOT create habits alone - must invite a partner
- **Viral by Design**: Every feature should encourage friend invites
- **Mobile-First**: React Native is the primary platform
- **Leverage Existing**: 60% of Therr infrastructure is reusable
