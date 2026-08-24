/**
 * Who may repost what.
 *
 * The access half of this lives on the server (`users-service handlers/thoughts createThought`,
 * which answers a violation with 403 THOUGHT_ACCESS_RESTRICTED). It is here rather than there
 * because the clients have to ask the same question to decide whether to render the control at
 * all — and when they answered it independently they got it wrong: every client mints replies
 * with `isPublic: false`, so a control gated only on "not a draft, not already a repost"
 * appeared on every reply in a thread and failed for everyone but its author.
 */

/** The subset of a thought these predicates read. Deliberately structural — the server's row,
 *  the Redux-held feed object, and a nested reply preview all satisfy it. */
export interface IRepostableThought {
    id?: string;
    fromUserId?: string;
    isDraft?: boolean;
    isPublic?: boolean;
    isRepost?: boolean;
}

/**
 * The server's access rule, and the only half of this the server itself enforces.
 *
 * Reposting is a public act — it puts the original in front of the reposter's audience. A
 * non-public thought is therefore only ever reposted by its own author (who is choosing to
 * surface their own post), never by a reader who happened to be granted access to it.
 */
export const isThoughtRepostableBy = (
    thought?: IRepostableThought | null,
    currentUserId?: string,
): boolean => {
    if (!thought) {
        return false;
    }

    return !!thought.isPublic || (!!currentUserId && thought.fromUserId === currentUserId);
};

/**
 * Whether a client should offer a repost control for this thought.
 *
 * Adds the two display rules the server has no opinion on:
 * - a draft has no id the server would accept as a repost target;
 * - a repost of a repost is collapsed onto the root server-side, so offering the control on one
 *   would silently re-share something other than the card the reader tapped.
 */
export const canRepostThought = (
    thought?: IRepostableThought | null,
    currentUserId?: string,
): boolean => {
    if (!thought?.id || thought.isDraft || thought.isRepost) {
        return false;
    }

    return isThoughtRepostableBy(thought, currentUserId);
};
