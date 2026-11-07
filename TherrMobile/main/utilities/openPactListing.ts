/**
 * What an open-pact card says about a pact, kept free of React Native so it can be unit-tested.
 * Shared by the OpenPacts screen and the feed's open-pact card (components/Habits/OpenPactListingCard).
 */

/** Above this many seats the dot row stops being glanceable, so the card shows the words alone. */
export const MAX_SEAT_DOTS = 10;

export interface IOpenPactSeats {
    /** Seats taken: members plus invites not yet answered. */
    filled: number;
    /** The server's ceiling, or null from a server that predates it. */
    total: number | null;
    /** Seats still open, or null when the ceiling is unknown. Never negative. */
    left: number | null;
    /** Whether to draw one dot per seat. */
    showDots: boolean;
}

export const getOpenPactSeats = (memberCount: number | null | undefined, maxMembers: number | null): IOpenPactSeats => {
    const filled = Math.max(0, Math.floor(memberCount || 0));

    if (!maxMembers || maxMembers <= 0) {
        return {
            filled,
            total: null,
            left: null,
            showDots: false,
        };
    }

    // The list never includes a full pact, but a stale count can briefly exceed the ceiling.
    const total = Math.max(maxMembers, filled);

    return {
        filled,
        total,
        left: Math.max(0, total - filled),
        showDots: total <= MAX_SEAT_DOTS,
    };
};

/**
 * The seat line's translation key and params. "1 spot left" and "2 spots left" are separate keys
 * because the translator has no plural rules.
 */
export const getOpenPactSeatsLabel = (seats: IOpenPactSeats): { key: string; params: Record<string, number> } => {
    if (seats.left === null) {
        return {
            key: seats.filled === 1 ? 'pages.pacts.openPact.memberCountOne' : 'pages.pacts.openPact.memberCount',
            params: { count: seats.filled },
        };
    }

    return {
        key: seats.left === 1 ? 'pages.pacts.openPact.spotsLeftOne' : 'pages.pacts.openPact.spotsLeft',
        params: { count: seats.left, filled: seats.filled, total: seats.total || 0 },
    };
};
