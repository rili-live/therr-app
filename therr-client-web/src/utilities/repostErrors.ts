/**
 * Which translation key explains a failed repost.
 *
 * Shared by the two surfaces that host a repost composer (ExploreThoughts, ViewThought) so they
 * cannot drift into saying different things about the same status code.
 *
 * - 400 — the server's duplicate guard: this user already reposted this thought.
 * - 403 — the original is not public and the user did not write it. The control is gated on the
 *   same rule the server enforces (`canRepostThought`), so in practice this only happens when
 *   the original went non-public between opening the composer and confirming. Retrying does not
 *   help, so it must not read like a transient failure.
 */
const getRepostErrorKey = (statusCode?: number): string => {
    if (statusCode === 400) {
        return 'pages.exploreThoughts.repostDuplicate';
    }

    if (statusCode === 403) {
        return 'pages.exploreThoughts.repostRestricted';
    }

    return 'pages.exploreThoughts.repostError';
};

export default getRepostErrorKey;
