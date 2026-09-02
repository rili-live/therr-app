import { IPact } from 'therr-react/types';

export type HabitsLandingTab = 'habits' | 'pending' | 'outgoing';

export interface IHabitsBadgeState {
    /** Number to show on the Habits tab. 0 means no badge. */
    badgeCount: number;
    /** Segment of the habits dashboard the tab should open onto. */
    initialTab: HabitsLandingTab;
}

/**
 * What the Habits tab should badge, and where tapping it should land.
 *
 * The badge counts only invites *received* and still awaiting this user's
 * accept/decline. It used to count invites the user had *sent*, which made it a
 * notification about someone else's inaction: nothing the user could do cleared
 * it, so an unanswered invite badged the tab bar indefinitely — one in testing
 * sat there for 105 days — and a badge that never clears teaches people to stop
 * reading badges. Everything counted here has an Accept/Decline one tap away.
 *
 * The landing segment follows the badge so the count and the destination always
 * agree: badge the tab, open the list the badge is about. With nothing awaiting
 * a reply it falls back to the previous behaviour — Sent when there is no active
 * pact to check in on, Habits when there is.
 *
 * Kept free of react-native imports so it stays unit-testable without the
 * native module graph the menu pulls in.
 */
export const getHabitsBadgeState = (
    pendingInvites: IPact[] | undefined,
    pacts: IPact[] | undefined,
    activePacts: IPact[] | undefined,
    currentUserId?: string,
): IHabitsBadgeState => {
    const badgeCount = (pendingInvites || []).length;
    const outgoingCount = (pacts || []).filter(
        (pact) => pact.status === 'pending' && !!currentUserId && pact.creatorUserId === currentUserId,
    ).length;
    const hasActivePacts = (activePacts || []).length > 0;

    let initialTab: HabitsLandingTab = 'habits';
    if (badgeCount > 0) {
        initialTab = 'pending';
    } else if (!hasActivePacts && outgoingCount > 0) {
        initialTab = 'outgoing';
    }

    return { badgeCount, initialTab };
};

export default getHabitsBadgeState;
