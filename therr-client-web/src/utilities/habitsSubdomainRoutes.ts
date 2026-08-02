/**
 * Path matching for the invite-style landings served on the Friends with Habits
 * subdomain (habits.therr.com).
 *
 * The habits host is handled by a dedicated middleware in server-client.tsx that
 * short-circuits React SSR and hard-404s anything outside its allowlist. These URLs
 * are minted by the HABITS brand's own emails and SMS (hostContext resolves
 * `appHostFull` to https://habits.therr.com), so they have to resolve here — the
 * equivalent React routes only exist on www.therr.com.
 *
 * Kept in its own module (rather than inline in server-client.tsx) so the matching
 * is unit-testable: importing server-client.tsx starts an Express listener.
 */

export type HabitsInviteRouteKind = 'invite-link' | 'invite-username' | 'claim-pact';

export interface IHabitsInviteRouteMatch {
    kind: HabitsInviteRouteKind;
    /** The captured token (invite-link, claim-pact) or userName (invite-username). */
    value: string;
}

// Tokens are UUIDs, but the match here is deliberately loose: a malformed token
// should still render the "get the app" landing rather than 404 an invite. Lookups
// that hit the API validate with UUID_V4_RE first.
const TOKEN_SEGMENT = '[A-Za-z0-9-]{8,64}';
// The token is optional so a truncated '/invite/link' still lands on the invite page
// (with a generic headline) instead of being read as a user named 'link'.
const INVITE_LINK_PATH_RE = new RegExp(`^/invite/link(?:/(${TOKEN_SEGMENT}))?/?$`);
const CLAIM_PACT_PATH_RE = new RegExp(`^/claim-pact/(${TOKEN_SEGMENT})/?$`);
// Usernames only — keep tight to avoid rendering a page for arbitrary paths.
const INVITE_USERNAME_PATH_RE = /^\/invite\/([A-Za-z0-9._-]{1,64})\/?$/;

export const UUID_V4_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/;

/**
 * Resolves a request path to the invite landing it should render, or null when the
 * path is not an invite-style route (the caller falls back to its own allowlist).
 */
export const matchHabitsInviteRoute = (pathname: string): IHabitsInviteRouteMatch | null => {
    // '/invite/link/:token' is matched first: it is more specific than
    // '/invite/:username', which cannot span the extra path segment anyway.
    const inviteLinkMatch = pathname.match(INVITE_LINK_PATH_RE);
    if (inviteLinkMatch) {
        return { kind: 'invite-link', value: inviteLinkMatch[1] || '' };
    }

    const claimPactMatch = pathname.match(CLAIM_PACT_PATH_RE);
    if (claimPactMatch) {
        return { kind: 'claim-pact', value: claimPactMatch[1] };
    }

    const inviteUserNameMatch = pathname.match(INVITE_USERNAME_PATH_RE);
    if (inviteUserNameMatch) {
        return { kind: 'invite-username', value: inviteUserNameMatch[1] };
    }

    return null;
};

export default matchHabitsInviteRoute;
