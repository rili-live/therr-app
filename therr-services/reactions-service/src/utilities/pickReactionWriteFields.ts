export type ReactionKind = 'moment' | 'space' | 'thought' | 'event';

// Every reaction table carries this set, and every one of them is something the user is
// meant to set about their own relationship to a piece of content.
const SHARED_WRITABLE_FIELDS: string[] = [
    'userViewCount',
    'userHasActivated',
    'userHasLiked',
    'userHasSuperLiked',
    'userHasDisliked',
    'userHasReported',
    'userHasSuperDisliked',
    'userBookmarkCategory',
    'userBookmarkPriority',
];

const WRITABLE_FIELDS_BY_KIND: { [kind in ReactionKind]: string[] } = {
    moment: SHARED_WRITABLE_FIELDS,
    thought: SHARED_WRITABLE_FIELDS,
    space: [
        ...SHARED_WRITABLE_FIELDS,
        'rating',
    ],
    event: [
        ...SHARED_WRITABLE_FIELDS,
        'rating',
        // The RSVP count from ViewEvent's attending modal. Not listed in the gateway's
        // createOrUpdateEventReactionValidation, so it only ever reached the table through the
        // `...req.body` spread this allow-list replaces — omitting it here would silently break
        // RSVP for every already-deployed install.
        'attendingCount',
    ],
};

/**
 * Returns the subset of a reaction create/update body that a client is allowed to write.
 *
 * The handlers used to spread `...req.body` straight into the store, and the store passes its
 * params object to `knex.insert()`/`knex.update()` unfiltered — the `ICreate*Params` interfaces
 * are compile-time only and the handlers are untyped `(req, res)`. express-validator at the
 * gateway validates the fields it lists but does not strip the ones it does not, so every
 * column on the table was mass-assignable by any authenticated user. The columns that mattered:
 *
 * - `main."thoughtReactions"."relevanceScore"` — the feed ordering key
 *   (`ORDER BY "relevanceScore" DESC NULLS LAST`). A client could pin any activated thought to
 *   the top of its own stream, and stamp an `algorithmKey` naming a profile that never scored
 *   the row, which is the one invariant that column exists to make observable.
 * - `contentLatitude` / `contentLongitude` / `contentLocation` on moment/space/event reactions —
 *   client-writable geo on rows nothing else writes geo to.
 * - `updateCount`, `createdAt`, `updatedAt`, `contentAuthorId`, and the space visit columns
 *   (`visitCount`, `visitedAt`, `lastVisitedAt`), all of which are server-derived.
 *
 * Unlisted fields are dropped silently rather than rejected with a 400. The deployed mobile app
 * cannot be force-updated, and `attendingCount` above is the proof that the set of fields real
 * clients send is wider than any validator declares — a 400 would have been an outage.
 *
 * The route-scoped keys (`momentIds`, `spaceIds`, `thoughtIds`, `eventIds`, `userIds`,
 * `recordVisit`, `relevanceScores`, `algorithmKey`) are absent from every allow-list by design.
 * Each handler reads the ones it needs off `req.body` directly and applies them itself, so they
 * must not ride along in the shared param set that gets spread into every row of a batch.
 */
const pickReactionWriteFields = (kind: ReactionKind, body: any): any => {
    const allowed = WRITABLE_FIELDS_BY_KIND[kind];
    const params: any = {};

    if (!body || typeof body !== 'object') {
        return params;
    }

    for (let i = 0; i < allowed.length; i += 1) {
        const key = allowed[i];

        // hasOwnProperty rather than an `!== undefined` check: `userBookmarkCategory: null` is
        // how every client un-bookmarks, so an explicit null has to survive the copy.
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            params[key] = body[key];
        }
    }

    return params;
};

export { SHARED_WRITABLE_FIELDS, WRITABLE_FIELDS_BY_KIND };

export default pickReactionWriteFields;
