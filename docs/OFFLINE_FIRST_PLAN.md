# Offline-First Implementation Plan

**Created:** April 2026
**Status:** Planning
**Branch:** `claude/plan-offline-first-IHzgp`

---

## Problem Statement

Users experience degraded UX during API gateway deploys, regional network outages, and poor cellular connectivity. Currently the app is fully online-dependent — every screen requires a successful API call to render content. When the network is unavailable, users see loading spinners, blank screens, or cryptic errors.

## Current State Assessment

### What exists today

| Capability | Mobile | Web |
|---|---|---|
| **Local storage** | AsyncStorage (auth tokens, user settings, socket session) | localStorage (same keys) |
| **State management** | Redux Toolkit (in-memory only) | Redux Toolkit (in-memory + SSR preload) |
| **State persistence** | Manual hydration of 3-4 keys on app start | Manual hydration of 3-4 keys on app start |
| **Network detection** | None | None |
| **Offline queue** | None | None |
| **Service worker** | N/A | None (CSP `workerSrc` already allows `'self'`) |
| **Local database** | None | None |
| **Image caching** | None (standard RN Image) | Browser cache only |
| **Retry logic** | Token refresh queue only (401s) | Token refresh queue only (401s) |
| **Optimistic updates** | None | None |

### Architecture advantages for offline-first

1. **Centralized API layer** — All HTTP calls go through axios singleton services in `therr-react/src/services/`. A single interception point for queuing/caching.
2. **Redux middleware pattern** — Socket.IO already uses Redux middleware; offline sync can follow the same pattern.
3. **Shared library** — `therr-react` is used by both mobile and web, so core offline logic can be written once.
4. **Interceptor infrastructure** — Both platforms have axios request/response interceptors that can be extended.
5. **Immutable state updates** — Redux slices use Immer's `produce()`, making cache snapshots straightforward.

---

## Design Principles

1. **Stale data is better than no data** — Show cached content immediately, refresh in background.
2. **Reads first, writes later** — Cache GET responses before tackling offline mutations.
3. **Shared core, platform adapters** — Offline logic in `therr-react`, storage adapters per platform.
4. **Backwards compatible** — All changes are additive. Existing API contracts unchanged. Server requires zero modifications in Phase 1-2.
5. **Graceful degradation** — Offline mode is best-effort. Features that fundamentally require a server (e.g., search, auth) show clear messaging rather than broken UI.
6. **No new databases in Phase 1** — Start with Redux persistence and simple key-value storage before introducing SQLite/IndexedDB.

---

## Phase 1: Foundation — Network Awareness & State Persistence

**Goal:** Users see cached content when the network drops. No blank screens. Clear connectivity indicators.

**Estimated scope:** ~15-20 files across 3 packages

### 1.1 Network Connectivity Detection

**Mobile** (`TherrMobile`):
- Install `@react-native-community/netinfo`
- Create `TherrMobile/main/utilities/networkService.ts`:
  - Subscribe to NetInfo state changes
  - Dispatch Redux action on connectivity change
  - Expose `isConnected()` helper

**Web** (`therr-client-web`):
- Create `therr-client-web/src/services/networkService.ts`:
  - Listen to `window.addEventListener('online'/'offline')`
  - Dispatch Redux action on connectivity change

**Shared** (`therr-react`):
- Add `network` Redux slice to `therr-react/src/redux/reducers/`:
  ```typescript
  interface INetworkState {
    isConnected: boolean;
    lastOnlineAt: number | null;
  }
  ```
- Action types: `SET_NETWORK_STATUS`

### 1.2 Connectivity UI Indicator

**Mobile:**
- Add a dismissable banner component (`OfflineBanner`) that appears at the top of the screen when offline
- Integrate into the root navigator/layout so it's visible on all screens
- Use a subtle yellow/amber color — not alarming, just informative

**Web:**
- Add equivalent `OfflineBanner` component in the app shell
- Position as a fixed top bar above the header

### 1.3 Redux State Persistence

**Shared** (`therr-react`):
- Add `redux-persist` as a dependency to the root `package.json`
- Create `therr-react/src/redux/persistConfig.ts`:
  - Define whitelist of slices to persist: `user`, `content`, `notifications`, `userConnections`
  - Exclude transient state: `map` (location-dependent), `messages` (real-time)
  - Configure state version for future migrations
  - Export platform-agnostic config (storage adapter injected per platform)

**Mobile** (`TherrMobile`):
- Update `TherrMobile/main/getStore.tsx`:
  - Wrap root reducer with `persistReducer` using AsyncStorage adapter
  - Add `PersistGate` in app root to delay render until rehydration completes
  - Remove manual localStorage hydration (replaced by redux-persist)

**Web** (`therr-client-web`):
- Update `therr-client-web/src/store.tsx`:
  - Wrap root reducer with `persistReducer` using localStorage adapter
  - Handle SSR: skip persistence on server, apply on client hydration
  - Remove manual localStorage hydration (replaced by redux-persist)

### 1.4 Stale-While-Revalidate for Read Operations

**Shared** (`therr-react`):
- Create `therr-react/src/utilities/cacheHelpers.ts`:
  - `isCacheStale(lastFetchedAt: number, maxAgeMs: number): boolean`
  - `withTimestamp<T>(data: T): T & { _cachedAt: number }`
- Update key Redux action creators to follow stale-while-revalidate:
  1. Return cached data from persisted Redux state immediately
  2. Fetch fresh data from API in background
  3. Update Redux state when fresh data arrives
  4. If fetch fails (offline), the cached data remains visible — no error shown
- Apply to these high-value action creators first:
  - `ContentActions.searchActiveMoments`
  - `ContentActions.searchActiveSpaces`
  - `ContentActions.getMyDrafts`
  - `NotificationActions.search`
  - `UserConnectionsActions.search`

### 1.5 Axios Interceptor: Graceful Failure

**Shared** (`therr-react`) or per-platform interceptors:
- Extend existing response error interceptors:
  - On network error (no response, timeout, `ERR_NETWORK`):
    - If `GET` request: resolve with empty data + flag `{ _fromCache: true, data: [] }` instead of throwing
    - If mutating request (`POST/PUT/DELETE`): reject with a structured `OfflineError` so UI can handle it
  - This prevents uncaught promise rejections that crash screens

### Phase 1 Deliverables

- [ ] Network connectivity detection (mobile + web)
- [ ] Offline banner UI component (mobile + web)
- [ ] Redux state persistence with redux-persist (mobile + web)
- [ ] Stale-while-revalidate pattern for top 5 read actions
- [ ] Graceful axios failure handling for GET requests
- [ ] Manual QA: toggle airplane mode, verify cached content displays

### Phase 1 Non-Goals

- No offline writes/mutations
- No conflict resolution
- No background sync
- No service worker (web)
- No local database

---

## Phase 2: Offline Write Queue & Optimistic Updates

**Goal:** Users can perform key write actions while offline. Actions are queued and synced when connectivity returns.

**Depends on:** Phase 1 complete

### 2.1 Offline Action Queue

**Shared** (`therr-react`):
- Create `therr-react/src/redux/offlineQueue.ts`:
  ```typescript
  interface IQueuedAction {
    id: string;              // UUID
    actionType: string;      // e.g., 'CREATE_MOMENT', 'TOGGLE_LIKE'
    payload: unknown;        // Request body
    endpoint: string;        // API path
    method: 'POST' | 'PUT' | 'DELETE';
    createdAt: number;
    retryCount: number;
    maxRetries: number;      // Default: 3
    status: 'pending' | 'syncing' | 'failed';
  }
  ```
- Add `offlineQueue` Redux slice:
  - `ENQUEUE_ACTION` — add to queue
  - `DEQUEUE_ACTION` — remove after successful sync
  - `MARK_FAILED` — after max retries
  - `CLEAR_QUEUE` — manual user action
- Include `offlineQueue` in redux-persist whitelist

### 2.2 Queue Processing Middleware

**Shared** (`therr-react`):
- Create Redux middleware `offlineQueueMiddleware`:
  - On `SET_NETWORK_STATUS` (online → true): trigger queue flush
  - Process queue items sequentially (FIFO order)
  - Exponential backoff on individual item failure (1s, 2s, 4s)
  - After max retries, mark as `failed` and move to next item
  - Dispatch success/failure actions so UI can react

### 2.3 Optimistic Updates for Key Actions

Apply optimistic update pattern to high-frequency user actions:

| Action | Optimistic Behavior | Rollback on Failure |
|---|---|---|
| **Like/unlike** | Toggle reaction count + state immediately | Revert count + state |
| **Create thought** | Add to `myDrafts` list immediately | Mark as "failed to post" |
| **Check-in** (Habits) | Record checkin locally | Remove checkin, show error |
| **Mark notification read** | Remove from unread count | Restore unread count |

**Pattern** (in action creators):
```typescript
// 1. Dispatch optimistic update
dispatch({ type: 'REACTION_OPTIMISTIC', payload: { areaId, reactionType } });

// 2. Attempt API call
try {
  await ReactionsService.createOrUpdate(payload);
  dispatch({ type: 'REACTION_CONFIRMED', payload: response });
} catch (err) {
  if (isOfflineError(err)) {
    // 3. Queue for later — optimistic state stays
    dispatch(enqueueAction({ ... }));
  } else {
    // 4. Real server error — rollback
    dispatch({ type: 'REACTION_ROLLBACK', payload: { areaId, reactionType } });
  }
}
```

### 2.4 Queue Status UI

**Mobile + Web:**
- Add a small badge/indicator showing pending sync count (e.g., "3 pending")
- When user taps, show list of queued actions with status
- Allow user to manually retry failed items or discard them
- Show toast/snackbar when queued items sync successfully on reconnection

### Phase 2 Deliverables

- [ ] Offline action queue (Redux slice + persistence)
- [ ] Queue processing middleware with retry logic
- [ ] Optimistic updates for likes, thoughts, check-ins, notification reads
- [ ] Queue status UI (badge + detail view)
- [ ] Rollback mechanism for failed optimistic updates
- [ ] Integration tests for queue processing

### Phase 2 Non-Goals

- No conflict resolution (last-write-wins is acceptable at this stage)
- No media upload queuing (only metadata/text mutations)
- No real-time message queuing (Socket.IO messages are ephemeral)

---

## Phase 3: Service Worker & Enhanced Caching (Web)

**Goal:** Web app works as a PWA with asset caching, API response caching, and background sync.

**Depends on:** Phase 1 complete (Phase 2 can be parallel)

### 3.1 Service Worker Setup

- Add `workbox-webpack-plugin` to build toolchain
- Configure `webpack.app.config.js`:
  - `GenerateSW` or `InjectManifest` plugin
  - Precache: HTML shell, JS bundles, CSS, fonts, static assets
  - Runtime caching strategies (see 3.2)
- Add `manifest.webmanifest` for PWA installability
- Register service worker in `therr-client-web/src/index.tsx`

### 3.2 Caching Strategies by Route

| Route Pattern | Strategy | Max Age | Notes |
|---|---|---|---|
| `/api/users-service/users/me` | StaleWhileRevalidate | 1 hour | User profile |
| `/api/maps-service/spaces*` | StaleWhileRevalidate | 30 min | Space listings |
| `/api/maps-service/moments*` | NetworkFirst | 15 min | More dynamic content |
| `/api/users-service/notifications*` | NetworkFirst | 5 min | Time-sensitive |
| `/api/reactions-service/*` | StaleWhileRevalidate | 30 min | Engagement data |
| Static assets (`*.js`, `*.css`) | CacheFirst | 30 days | Content-hashed filenames |
| Images (`/media/*`) | CacheFirst | 7 days | Space photos, avatars |
| SSR HTML pages | NetworkFirst | 1 hour | Fallback to cached shell |

### 3.3 Background Sync (Web)

- Use Workbox `BackgroundSyncPlugin` for queued mutations
- Register sync events for the offline action queue from Phase 2
- Service worker processes queue even if tab is closed (on supported browsers)

### 3.4 Offline Fallback Page

- Create a lightweight offline fallback page (`/offline.html`)
- Service worker serves this when both network and cache miss
- Page shows: app branding, "You're offline" message, retry button

### Phase 3 Deliverables

- [ ] Service worker with Workbox integration
- [ ] PWA manifest file
- [ ] Runtime caching strategies per API route
- [ ] Background sync for offline queue
- [ ] Offline fallback page
- [ ] Lighthouse PWA audit passing

---

## Phase 4: Image & Media Caching (Mobile)

**Goal:** Images load instantly from cache. Avatars, space photos, and map tiles don't re-download.

**Depends on:** Phase 1 complete

### 4.1 Fast Image Caching

- Install `react-native-fast-image` in `TherrMobile/package.json`
- Replace `<Image>` with `<FastImage>` for:
  - User avatars
  - Space/moment/event cover photos
  - Thought media attachments
- Configure cache priorities:
  - Avatars: `cacheControl: 'immutable'` (they rarely change)
  - Content images: `cacheControl: 'web'` (browser-like caching)

### 4.2 Map Tile Caching

- Evaluate `react-native-maps` tile caching options
- For frequently visited areas, cache map tiles locally
- Set maximum cache size (e.g., 100MB) with LRU eviction

### 4.3 Prefetch Strategy

- When user views a list of spaces/moments, prefetch images for the first 10 items
- Use `FastImage.preload([...uris])` on list render
- Don't prefetch on metered connections unless user opts in

### Phase 4 Deliverables

- [ ] FastImage integration for all image components
- [ ] Map tile caching for visited areas
- [ ] Image prefetching on list views
- [ ] Cache size management with LRU eviction

---

## Phase 5: Local Database & Full Offline Mode (Future)

**Goal:** Full offline content browsing with structured queries, search, and rich sync.

**Depends on:** Phases 1-2 complete

### 5.1 Local Database

- **Mobile:** Evaluate WatermelonDB (built on SQLite, lazy loading, sync primitives) vs. raw SQLite
- **Web:** IndexedDB via Dexie.js
- Mirror key server tables locally:
  - `spaces` (id, title, description, latitude, longitude, media, rating, updatedAt)
  - `moments` (id, message, media, latitude, longitude, createdAt)
  - `thoughts` (id, message, parentId, hashtags, createdAt)
  - `reactions` (id, areaId, areaType, reactionType, userId)
  - `notifications` (id, type, message, isRead, createdAt)

### 5.2 Sync Protocol

- Use `updatedAt` watermark for incremental sync
- Client sends `lastSyncedAt` timestamp, server returns changed records since then
- Server-side: Add `/sync` endpoints to each service that return delta changes
- Client-side: Merge deltas into local DB, handle deletes via soft-delete flag

### 5.3 Conflict Resolution

- Default: **Last-write-wins** based on `updatedAt`
- For user-generated content (thoughts, moments): **Client wins** — user's intent takes priority
- For reactions (likes): **Server wins** — server is source of truth for aggregate counts
- For settings: **Merge** — combine non-conflicting field changes

### Phase 5 Deliverables

- [ ] Local database setup (mobile + web)
- [ ] Schema mirroring for key entities
- [ ] Incremental sync protocol with watermark
- [ ] Server-side `/sync` endpoints
- [ ] Conflict resolution strategy per entity type
- [ ] Data migration from redux-persist to local DB

---

## Implementation Notes

### Package Changes Summary

| Package | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| `therr-react` | redux-persist, network slice, cache helpers | offline queue slice + middleware, optimistic actions | — | — |
| `TherrMobile` | @react-native-community/netinfo, OfflineBanner, persist config | queue UI | — | react-native-fast-image |
| `therr-client-web` | OfflineBanner, persist config | queue UI | workbox-webpack-plugin, manifest | — |
| Root `package.json` | redux-persist | — | workbox-webpack-plugin | — |

### Backwards Compatibility Guarantees

1. **No server changes in Phases 1-4** — All offline logic is client-side only
2. **No API contract changes** — Existing endpoints remain unchanged
3. **No database migrations** — Server schema is untouched until Phase 5
4. **Graceful fallback** — If redux-persist fails to hydrate, app falls back to fresh state (current behavior)
5. **Feature flag** — Wrap offline features behind a `FEATURE_OFFLINE_MODE` flag in env-config so they can be disabled

### Testing Strategy

- **Unit tests:** Cache helpers, queue processing logic, stale-while-revalidate
- **Integration tests:** Queue flush on reconnection, optimistic update + rollback
- **Manual QA checklist:**
  - Toggle airplane mode mid-session
  - Kill and restart app while offline (should show cached data)
  - Queue 5+ actions offline, reconnect, verify all sync
  - Verify no duplicate submissions after queue sync
  - Test on slow 3G (not just on/off — degraded is common)

### Risk Mitigation

| Risk | Mitigation |
|---|---|
| Stale data misleads users | Show "last updated X ago" timestamp on cached content |
| Queue grows unbounded | Cap at 50 items, warn user, auto-discard items older than 24h |
| Duplicate submissions | Idempotency keys on queued mutations; server should handle duplicate creates gracefully |
| Storage quota exceeded | Monitor storage usage, evict oldest cached content first |
| Redux-persist migration breaks | Version the persist config, write migration functions between versions |
| SSR + persist conflicts (web) | Only hydrate persist state on client side, never on SSR pass |

---

## Recommended Execution Order

```
Phase 1 (Foundation)          ← START HERE
  ├── 1.1 Network detection
  ├── 1.2 Offline banner
  ├── 1.3 Redux persistence
  ├── 1.4 Stale-while-revalidate
  └── 1.5 Graceful axios failures
       │
       ├──── Phase 2 (Write Queue)     ← After Phase 1
       │       ├── 2.1 Queue slice
       │       ├── 2.2 Queue middleware
       │       ├── 2.3 Optimistic updates
       │       └── 2.4 Queue status UI
       │
       └──── Phase 3 (Service Worker)  ← Parallel with Phase 2
       │       ├── 3.1 SW setup
       │       ├── 3.2 Caching strategies
       │       ├── 3.3 Background sync
       │       └── 3.4 Offline fallback
       │
       Phase 4 (Image Caching)         ← Parallel with Phase 2/3
               ├── 4.1 FastImage
               ├── 4.2 Map tiles
               └── 4.3 Prefetch
                    │
                    Phase 5 (Local DB)  ← Future, after 1-4 stable
```

Phases 2, 3, and 4 can be developed in parallel after Phase 1 is stable. Phase 5 is a larger effort that should wait until the simpler caching layers prove their value.
