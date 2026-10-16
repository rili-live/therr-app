import { IPact } from 'therr-react/types';

export type HabitsLandingTab = 'habits' | 'pending';

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
 * agree: badge the tab, open the list the badge is about. Otherwise it opens on
 * the Habits list, because checking in is what people tap the tab to do. It used
 * to open on Sent whenever the user had no active pact but an unanswered invite
 * out, which buried solo habits behind a list the user could not act on beyond
 * a nudge — and that list is still one segment tap away.
 *
 * Kept free of react-native imports so it stays unit-testable without the
 * native module graph the menu pulls in.
 */
export const getHabitsBadgeState = (
    pendingInvites: IPact[] | undefined,
): IHabitsBadgeState => {
    const badgeCount = (pendingInvites || []).length;

    return {
        badgeCount,
        initialTab: badgeCount > 0 ? 'pending' : 'habits',
    };
};

export default getHabitsBadgeState;
