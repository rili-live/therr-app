# Friends with Habits — Play listing update (2026-09-24)

Copy for Play Console → **Grow users → Store presence → Main store listing** on
`com.therr.habits`, from the `/aso-listing audit habits` run of 2026-09-24. Paste it,
then work through [Follow-up steps](#follow-up-steps).

The live listing still carries the **May** copy. The canonical listing doc
(`docs/niche-sub-apps/HABITS_PLAY_LISTING.md`, on `niche/HABITS-general`) was updated on
2026-09-03, but that update was never pasted into Play Console, and it is out of date again
anyway (it says 5 free habits; the code now allows 3).

## Why the listing is changing

| Live claim | What's true today | Source |
|---|---|---|
| Free tier: "1 active pact at a time" | 3 active habits, and up to 5 new starts per 30 days | `FeatureFlags.ts` `DEFAULT_HABITS_FREE_HABIT_LIMIT`, `..._STARTS_PER_WINDOW` |
| "Premium ($6.99/month) — coming soon": video proof, custom consequences, health integrations, advanced insights | The in-app offer is the $19.99 one-time Founder unlock for the first 5,000 accounts. None of the four listed features exists. | `habitsLifetime.ts`, `pages.upgrade.*` locale strings |
| "We don't need your … contacts" | The habits build declares `READ_CONTACTS`. Onboarding offers an optional contacts sync that sends numbers and emails to `/users/connections/find-people`. | `AndroidManifest.xml`, `CreateProfile/index.tsx`, `utilities/contacts.ts` |
| Nothing about phone verification | Phone verification is a required onboarding step, and the funnel's biggest drop (GA4, last 28 days: 87 profile starts → 20 verified phones) | `CreateProfile` `STAGE_ORDER` |
| "95% of people who track habits with a partner stick with them. Without a partner, only 10% do." | Widely repeated, with no primary source. Removed. | — |
| Screenshots 1–3: splash screen plus two stock-photo onboarding slides | Search results show only the first three, and none of them shows the product or a partner | live listing |

**Position:** lead with **accountability partner**, keep "habit tracker" as the category
word. There is no ad data to confirm this yet (both Friends with Habits campaigns are paused,
with $0 spent in the last 28 days), so it's the hypothesis `habits-web-landing.yaml` will test,
not a finding. The listing now states the partner requirement and the phone check up front. That will
cost some installs, and should cut the installs that end in an uninstall (GA4, last 28 days:
50 `app_remove` against 143 `first_open`).

---

## Copy to paste (en-US)

### App name — 29 / 30

```
Friends with Habits: Partners
```

The "Partners" suffix is optional. It adds the partner keyword from the
accountability ad group. If you'd rather keep the title identical to the ads and web
("Friends with Habits", 19), leave it as is: the description carries the keywords either way.
Changing the store title doesn't change the app's name under the launcher icon.

### Short description — 74 / 80

```
Habit tracker with an accountability partner. Make a pact, share a streak.
```

### Full description — 2,433 / 4,000

```
Friends with Habits is a habit tracker built around an accountability partner. Every habit is a pact with a friend: you both check in, and you both see it when someone misses.

Most habit trackers are built for one person, which makes quitting quietly easy. Here, somebody notices.

HOW A PACT WORKS
1. Pick a habit — a workout, reading, meditation, a language lesson — and how often: every day, a few times a week, or on set days.
2. Invite a friend to be your habit buddy. If they don't have the app yet, your invite link walks them through it.
3. Check in with a photo or a short note as proof. Your partner sees your check-in, and you see theirs.
4. Keep the streak alive together. The streak is shared, so a missed day costs you both.

BEFORE YOU INSTALL
• Friends with Habits is built for two. Your first habit starts with an invite, so have someone in mind — a friend, partner, sibling or coworker.
• You'll verify your phone number when you sign up.
• Invite three friends and you can also track habits on your own.

WHAT'S FREE
Friends with Habits is free to download and free to use: no waitlist, no invite code, no card. A free account keeps a limited number of habits active at a time, and archiving a habit you're finished with frees up a slot.

FOUNDING MEMBER OFFER
The first 5,000 accounts can pay $19.99 once to unlock unlimited habits and every premium feature we add later, for life. It's not a subscription and there's nothing to cancel. You buy it inside the app through Google Play.

WHAT'S INSIDE
• Pacts with your accountability partner, for daily or weekly habits
• Photo and note check-ins as proof
• Shared streaks with milestones to aim for
• Daily habit reminders and evening streak reminders
• Nudges: remind a partner who hasn't checked in yet
• A journal alongside your habits
• A feed of check-ins people choose to share

YOUR PRIVACY
• No location tracking and no microphone access.
• Your phone number verifies your account and lets friends who already have your number find you.
• Finding friends from your contacts is optional. If you allow it, their phone numbers and emails are checked against existing accounts to show you who's already here. We don't keep your address book, and we don't message anyone in it unless you choose to invite them.
• You can delete your account at any time from Settings.

Make your first pact tonight. All you need is one friend who wants to change something too.
```

Keyword use is deliberately light, to stay clear of Play's keyword-stuffing policy: "habit tracker" ×2,
"accountability partner" ×2, "habit buddy" ×1, "streak" ×4, "pact" ×4.

**Deliberately left out:**
- **The free-habit count.** Same reason as the web fix in f53c4ec8d: it's a server flag,
  and a pasted listing goes stale silently when it changes.
- **The $6.99 monthly plan.** It's built (`habitsPremium.ts`), but its Play subscription
  product is still an open follow-up in `WORK_IN_PROGRESS.md`, and the app hides the monthly
  option until the product resolves. Once `habits_premium_monthly` is active, you can add this line to the end of the
  founding-member paragraph: *"A monthly plan is also available in the app."* As of 2026-09-24 the
  production paywall says "The monthly plan is not available on this device right now", so leave the line out.
- **"$20".** The web copy rounds to $20. Play charges $19.99 (the paywall shows that price), and the
  listing is where people buy, so it uses the exact figure.

---

## Screenshots

Replace all 7 current screenshots with these 7, in this order. They are the portrait frames in
`scripts/google-ads/assets/habits/` (`portrait-1200x1500-<concept>.png`), and a numbered copy
ready to upload is in `~/Downloads/fwh-play-listing/`:

| # | Concept | Line | Screen |
|---|---|---|---|
| 1 | `partner` | "Someone else is counting on you." | Start your first pact: pick a goal, invite a friend, lock in |
| 2 | `partners` | "See who showed up." | Pact Details: your partner, your check-ins next to theirs, the timeline |
| 3 | `streak` | "Don't break the streak." | 13-day streak and the next milestone |
| 4 | `feed` | "Proof, not promises." | Feed of photo check-ins |
| 5 | `journal` | "Every check-in, on the record." | Journal timeline of completed check-ins |
| 6 | `schedule` | "Any habit. Any schedule." | Dashboard with a weekly savings pact and the XP leaderboard |
| 7 | `founder` | "Pay once. Keep it for life." | Founder paywall at $19.99 |

All 7 are 1200×1500 PNGs with no alpha channel, within Play's rules (each side 320–3840 px, long
side at most 2× the short side). The first three appear in search results. Together they make the
argument without the description: a pact needs a partner, you can see whether they showed up, and
the streak is shared. The old `pact` frame (the emulator dashboard) is dropped because `schedule`
shows the same screen with current UI.

All 7 come from `build_frames.py`, so the listing and the ads use the same art, and a UI change
means recapturing and re-running one command. Sources 07–11 are device captures from 2026-09-24,
edited before committing to remove personal identity:
- **All five:** status-bar notification icons removed, and the owner's profile photo replaced with the app's placeholder.
- **Names:** real usernames and names replaced with demo names (feed: `jordan.moves`, `theo.daily`;
  partner: Maya Chen).
- **Paywall:** the seat meter ("5,000 of 5,000 founder spots left") is cut, and so is the Monthly
  card, which the production paywall says is not available.
- **Pact detail:** the "Abandon Pact" button is removed.

HABITS_PLAY_LISTING.md on `niche/HABITS-general` records the same edits.

**Before uploading #4:** the two photos in the feed are real check-ins. Only the names were
changed; the photos themselves are original. The watch photo was posted by a different account
from the owner's. If that account isn't yours, get its owner's OK before the photo goes on a
public store page, or recapture the feed from a demo account.

---

## Follow-up steps

**Before pasting**

- [x] ~~Confirm the production paywall shows a price and a buy button.~~ Done 2026-09-24: it
  shows "Unlock for life · $19.99", so the Founder product is live. The monthly plan is not.

**Paste**

- [ ] Play Console → Store presence → Main store listing: paste the name, short
  description and full description. Replace the screenshots as listed above. Save and send for review.
- [ ] Record the publish date (the day review passes, not the day you submitted) in the
  `WORK_IN_PROGRESS.md` follow-up for this change.

**Data safety form.** The listing now says the true thing, but the form still says the old one.
Update it in the same sitting, because a mismatch between the two is itself a policy problem.

- [ ] **Contacts** — `HABITS_PLAY_LISTING.md` answers "Not collected" on the reasoning that the
  prompt never fires on the habits build. That's no longer true: the optional onboarding sync
  sends contacts' numbers and emails to the server. Suggested answer: **Collected**,
  **Optional**, **processed ephemerally: Yes** (the server matches them against existing accounts
  and stores only the resulting "might know" links, not the address book; see
  `findPeopleYouMayKnow`), purpose **App functionality**.
- [ ] **Phone number** — the doc says "Optional … HABITS does not require SMS verify". It is now
  **Required** (onboarding verifies it). Purposes: Account management, App functionality (friend
  matching), Fraud prevention.
- [ ] **Purchase history** — the doc answers No because billing runs through Google Play. The
  users-service does store purchase records (`habits.lifetime_purchases`,
  `habits.subscription_purchases`). Check Google's current guidance on data your backend keeps
  about Play Billing purchases, and update the answer if it applies.
- [ ] Remove the rationale lines about "Health app integrations" and "Video proof" being
  advertised in the listing: the new copy no longer mentions either.

**Measure**

- [ ] 28 days after the publish date, compare listing conversion against the 28 days before.
  Use `./therrplay acquisition --app habits --start <d-28> --end <d>` in `scripts/google-play`,
  and sum visitors and acquisitions across the rows.
  - Baseline: **25.2%** (51 of 202 visitors, 2026-08-25 to 09-18). The window before that was
    32.4% (34 of 105).
  - At about 7 visitors a day, only a large change will show. Judge the listing mainly on what
    it is meant to fix, from GA4 property `267810693` (stream "Friends with Habits"): **`app_remove`
    per `first_open`** (baseline 35%) and **`phone_verify_success` per `first_open`** (baseline 14%).
    A small dip in conversion alongside fewer uninstalls is a win.
  - Anything else that changes in that window will swamp the listing effect, so note it: in
    particular a resumed `habits-app-install` or `habits-web-landing` campaign, or a Founder price change.
  - Don't run a Store Listing Experiment until the listing gets a few thousand visitors a month.

**Later**

- [ ] Fold this copy and the Data safety fixes into `docs/niche-sub-apps/HABITS_PLAY_LISTING.md`
  on `niche/HABITS-general`, the canonical doc, so the two don't disagree. Then add
  `TherrMobile/fastlane/metadata/android/en-US/{title,short_description,full_description}.txt` on the
  same branch, so the listing is versioned alongside the release notes.
- [ ] Localize with `/aso-listing localize habits`. The listing is en-US only for now, and
  that's knowingly left that way: both campaigns target English only. es-419 and fr-CA need
  a translation pass before the campaigns go beyond English.
- [ ] Still worth capturing: the check-in modal while a photo is being attached. #4 shows the
  result, but no screenshot shows the moment of proof from the check-in side.
- [ ] Optional: add a 1024×500 format to `build_frames.py`, so the feature graphic uses the
  same art as the ads and screenshots.
