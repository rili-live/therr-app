# Drafting replies to accountability threads

Rules for the daily scheduled session that drafts Reddit replies from `find_threads.py` output.
A person reads every draft and posts the ones worth posting, by hand, from their own account.
These rules exist so that what they post helps the reader and survives the subreddit's moderators.

## Never

- **Post, comment, vote or message on Reddit, or log in to it.** The job only reads and drafts.
- Draft for a post that reads as a crisis (self-harm, abuse, an emergency). Skip it and say why.
- Use the same wording twice in one digest. Identical comments across threads are what spam
  filters catch, and they read as copy-paste to a human too.
- Invent facts about the app. Check `docs/FEATURES.md`: free tier is 3 active habits, pacts are
  2–5 people, lengths are 7/14/30/60/90 days, Android only (iOS has a waitlist).

## Every draft

1. **Answer the person first.** Respond to what they actually wrote — their habit, what made
   them quit before, what they asked for. One concrete, useful suggestion that works without any
   app (pick a start time, shrink the habit, agree a daily check-in time with a partner, decide in
   advance what a missed day costs).
2. **Offer the human thing they asked for.** If they want a partner, say so plainly: other people
   in the thread, a friend they could ask, or the poster (the person posting can offer to pair up).
3. **Mention Friends with Habits only when it fits and the subreddit allows it.** Read the rules
   the script printed for that subreddit. If self-promotion or links are banned or restricted
   (many ban them outright, others need a ratio of non-promotional activity), write the draft
   with no app mention at all and mark it `no-promo`. When it is allowed:
   - Disclose: "I made an app for this" or "I'm building…". Undisclosed promotion is against
     Reddit's rules everywhere.
   - One sentence, after the help, never the opener.
   - Link `https://habits.therr.com` — or suggest they start a challenge and share its link, if
     they want several partners at once.
4. **Keep it short:** 40–120 words, plain sentences, no bullet lists, no headers, no emoji spam,
   no marketing adjectives. It should read like a person who has been where they are.
5. Match the thread's language (a Spanish post gets a Spanish reply).

## Output, per thread

```
### <n>. r/<subreddit> — <title>
<url>
Why: <one line: what they asked for, and why a reply helps>
Promo: allowed | no-promo (<rule that decided it>)

<draft reply>
```

End the digest with one line: how many threads were found, how many were skipped and why.
