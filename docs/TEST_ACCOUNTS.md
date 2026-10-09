# Test Accounts (store review & QA)

Google Play review signs in with a real login (`rili.main@gmail.com`) and posts random text to
check that posting works. Before this existed, that text landed in real users' feeds. Test
accounts now get a flag that keeps their content away from real users while the app still works
end to end for the reviewer, and a worker purges what they leave behind.

## How an account becomes a test account

`AccessLevels.TEST_ACCOUNT` (`'user.test.account'`) on `main.users.accessLevels`. Read it only
through `isTestAccount()` from `therr-js-utilities/http`, which accepts either the forwarded
request headers or an access-levels array.

users-service grants it to every email in `TEST_ACCOUNT_EMAILS` (comma-separated, set in
`k8s/prod/users-service-deployment.yaml`). Emails are matched the way sign-up stores them, so
gmail dots and case don't matter. The flag travels in the JWT, so **it takes effect at the
account's next sign-in or token refresh**. A session that was already open keeps posting
publicly until then, and the worker's hide step covers that window.

To flag an account by hand instead:

```sql
UPDATE main.users SET "accessLevels" = "accessLevels" || '["user.test.account"]'::jsonb
WHERE email = '<normalized email>';
```

## What the flag does

The reviewer sees everything they post. Real users see none of it.

| Surface | Behaviour for a test account | Where |
|---|---|---|
| Thoughts (top level, reposts) | Created private | `users-service/src/handlers/thoughts.ts` `createThought` |
| Thought replies on anyone's thread | Hidden from non-test viewers in the details view and in feed reply previews/counts | `ThoughtsStore` `hideTestAccountReplies` |
| Shared habit check-ins | Created private; still reported as shared | `handlers/habitCheckins.ts` `shareCheckin` |
| Moments, spaces, events (create + update, incl. quick reports) | Forced private | `maps-service/src/utilities/keepTestAccountContentPrivate.ts` |
| Forums / groups (incl. group activities) | Forced private | `messages-service/src/handlers/forums.ts` |
| Open pacts | Real users never see a test account's open pact; a test account only sees other test accounts' | `PactsStore.getOpenPacts` |
| Leaderboards (live and weekly snapshot) | Excluded | `UserLeaderboardScoresStore.applyEligibilityFilters`, `LeaderboardPeriodResultsStore.closePeriod` |
| In-app notifications + push via `notifyUserOfUpdate` | Dropped when the recipient is not a test account | `users-service/src/utilities/notifyUserOfUpdate.ts` |

Test accounts can still see and notify **each other**, so a two-device review works.

## Cleanup worker

`users-service/src/utilities/testAccountCleanupWorker.ts` runs 2 minutes after boot and then
every 6 hours. Each tick:

1. **Flag**: grants the access level to `TEST_ACCOUNT_EMAILS`.
2. **Hide**: sets everything the flagged accounts posted to private (covers content from before
   they were flagged).
3. **Purge**: only with `TEST_ACCOUNT_CLEANUP_ENABLED=true`. Deletes thoughts, moments, events,
   forums (their messages cascade), forum messages and the direct messages the account *sent*,
   for anything older than `TEST_ACCOUNT_CONTENT_RETENTION_HOURS` (default 48, minimum 1).
   Spaces are only hidden, never deleted, because other users' moments and incentives can hang
   off them.

The account itself is never deleted, and nor are its habits, pacts or check-ins (only it and
its pact partners can see those). The super admin is never cleaned up, even if flagged. Steps 2
and 3 go to the internal `DELETE /test-account-content` endpoint on maps-service and
messages-service, which refuses any user whose forwarded access levels lack the flag.

Logs: `Test account content cleaned up` (per service, with counts) and `Test account cleanup
failed`.

## Known gaps — #3073

A test account can still reach a real user through these. Each needs a block-or-purge decision:

- **Pact invitations**: push, email or SMS to the partner (`dispatchPactInvitation`, direct
  `sendEmailAndOrPushNotification` calls in `handlers/pacts.ts`)
- **Connection requests**: pending row and push (`handlers/userConnections.ts`)
- **Direct messages**: delivered live; purged only after the retention window
- **Likes / super-likes**: counts and like notifications (websocket-service, reactions-service);
  test reactions are never purged
- **User search and suggestions**: still list the test profile
- **Space claims, space requests and corrections**: land in the admin queue. Reject anything
  from the review account.
- **Integrated (social-import) moments**: forced public
- **Uploaded media**: never removed from cloud storage

Cross-repo: the messaging automator still emails test accounts like any user. That is harmless,
but it counts them in its own metrics.

## Other leftovers found during the audit

- `SpacesStore.reassign` (account deletion) wrote the space's **primary key** instead of
  `fromUserId`. Spaces owned by a deleted account were never handed to the super admin, and
  deleting an account with two or more spaces failed on a primary-key conflict (by then its
  moments were already gone). Fixed alongside this doc; existing production rows need the
  follow-up check in `WORK_IN_PROGRESS.md`.
- `createForum` stores `isPublic: req.body.isPublic || true`, so a forum can never be created
  private by a normal user. Left as is; a test account's forum is forced private regardless.
