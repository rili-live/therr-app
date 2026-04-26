# Peer Review Follow-Up Tracker

This file tracks deferred work surfaced during peer reviews of the `general → stage` chain.
Items here are intentionally **not blocking** the review they were found in — either because
the risk/reward of doing them inline was poor, or because the work spans more code than the
original PR's scope.

When you pick something up, change its **Status** to `In progress (<your-name>, <date>)`,
land the change, and either delete the entry or move it under "Done" with the commit SHA.

---

## Open

### 1. Unify `BrandScopedStore.ts` across services

**Status**: Open
**Origin**: peer review of Phases 2/3/5 multi-app data isolation (2026-04-26)

Four services (`users`, `messages`, `maps`, `reactions`) each carry a byte-identical 58-line
`src/store/BrandScopedStore.ts`. The helper functions it depends on (`assertBrand`,
`applyBrandFilter`, `withBrandOnInsert`) already live in `therr-js-utilities/src/db/brand-scoped.ts`,
but the abstract class itself was duplicated because:

- It uses `KnexBuilder` at runtime — adding `knex` to `therr-js-utilities` would put a heavy
  backend dep into a library that is also consumed by web/mobile bundles.
- Each service's `IConnection` is defined locally and imports `pg.Pool`, so a shared base
  needs a generic connection type or a minimal structural interface.

**Recommended approach** (preserves frontend bundle health):

1. Create `therr-public-library/therr-js-utilities/src/db-server/brand-scoped-store.ts` —
   a separate subpath that consumers must opt into. Web bundles import from
   `therr-js-utilities/db` (existing) and `therr-js-utilities/constants` (existing); they
   would continue to work without pulling in the new file.
2. Define a structural connection interface in that file so the class is generic over the
   actual `IConnection`:
   ```ts
   export interface IBrandScopedConnection {
       read: { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }> };
       write: { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }> };
   }
   export default abstract class BrandScopedStore<TConn extends IBrandScopedConnection = IBrandScopedConnection> { ... }
   ```
3. In each service, replace `src/store/BrandScopedStore.ts` with a one-line re-export:
   ```ts
   export { default, BrandValue } from 'therr-js-utilities/db-server/brand-scoped-store';
   ```
4. Verify integration tests still pass — this exercise also catches any divergence between
   the four copies that's not visible in `git diff`.

**Risk**: Touches every brand-scoped store in 4 services. Mostly mechanical, but a regression
here breaks every brand-scoped query path. Run the full integration test matrix
(`npm run pr:test:integration:all`) before merging.

**Why deferred**: The peer review that surfaced this had already corrected stale test
expectations and removed dead code; layering an import-graph refactor on top would have
expanded the diff well past the original review's scope.

---

### 2. Drop `users.deviceMobileFirebaseToken` legacy column

**Status**: Open
**Origin**: Phase 2 multi-app data isolation rollout

Once mobile clients have re-registered against the new `/users` endpoint that dual-writes to
`main.userDeviceTokens`, the fallback path in
`therr-services/users-service/src/utilities/sendEmailAndOrPushNotification.ts` (`resolveDeviceTokenForBrand`)
can be deleted, and the legacy column can be dropped in a follow-up migration.

**Trigger**: After one full release cycle has elapsed AND the `[brand-scope:shadow]` warnings
in `userDeviceTokens` access logs are clean (zero hits in the last 7 days). Confirm via the
ELK dashboard before scheduling the migration.

**Steps**:

1. Add migration `<date>_main.users.dropDeviceMobileFirebaseToken.js` with `dropColumn` /
   `addColumn` symmetry.
2. Remove `resolveDeviceTokenForBrand` and inline `destinationUser.deviceMobileFirebaseToken`
   readers in `sendEmailAndOrPushNotification.ts`.
3. Remove the `clearDeviceToken` overload that operates on the legacy column.

---

### 3. Flip brand-scoped stores from `shadow` to `enforce`

**Status**: Open
**Origin**: Phases 2/3/5 multi-app data isolation rollout

Every brand-scoped store currently constructs with `mode: 'shadow'`:

- `therr-services/users-service/src/store/NotificationsStore.ts`
- `therr-services/users-service/src/store/UserAchievementsStore.ts`
- `therr-services/users-service/src/store/UserDeviceTokensStore.ts`
- `therr-services/messages-service/src/store/DirectMessagesStore.ts`
- `therr-services/messages-service/src/store/ForumsStore.ts`
- `therr-services/messages-service/src/store/ForumMessagesStore.ts`

Shadow mode logs a warning when a missing/unknown brand reaches the store; enforce mode
throws `MissingBrandContextError`. The intent is one release cycle in shadow to surface any
caller paths that don't pass a brand, then flip to enforce.

**Trigger**: After one full release cycle AND zero `[brand-scope:shadow]` warnings in logs
for the affected store.

**Steps**: Change the constructor `super(...)` call from `'shadow'` to `'enforce'` in each
store. No migration needed.

---

### 4. Mobile tsc baseline payoff

**Status**: Open (ongoing)
**Origin**: RN 0.83 upgrade (2026-04-19)

The mobile app inherits 107 pre-existing TypeScript errors from the RN 0.83 / Reanimated 4 /
Worklets bump. CI now uses `_bin/check-mobile-tsc-baseline.sh` to fail only on regressions,
but the standing 107 errors should be paid down opportunistically.

**How to chip away**:

1. Pick a file with a small error count (`npm run pr:typecheck:mobile 2>&1 | grep TherrMobile | sort | head`).
2. Fix the errors in that one file.
3. Run `./_bin/check-mobile-tsc-baseline.sh --update` to lower the committed baseline.
4. Commit the file fix and the updated `TherrMobile/.tsc-baseline` together.

The baseline must monotonically decrease — never raise it without explicit justification
(library upgrade with new typings, framework version bump, etc.).

---

## Done

_Move entries here with the merge SHA when complete; trim periodically._
