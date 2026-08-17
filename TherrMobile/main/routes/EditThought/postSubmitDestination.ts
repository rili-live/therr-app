/**
 * Where a user lands after posting a thought.
 *
 * Kept out of the screen (and free of React Native imports) so it can be unit
 * tested directly — the same trick `routes/Journal/journalGrouping.ts` uses.
 *
 * The screen is opened from several places that disagree about what "done"
 * means. A caller that has its own answer passes `returnToRoute` and gets the
 * user back where they started; without one we fall back to the app-wide
 * default, which depends on whether the Areas feed exists in this build.
 */
export interface IPostSubmitDestination {
    route: string;
    params?: any;
}

export interface IPostSubmitDestinationArgs {
    /** Caller-supplied override, e.g. the journal's "share a goal" entry point. */
    returnToRoute?: string;
    returnToRouteParams?: any;
    isAreasEnabled: boolean;
    userId?: string;
}

export const getPostSubmitDestination = ({
    returnToRoute,
    returnToRouteParams,
    isAreasEnabled,
    userId,
}: IPostSubmitDestinationArgs): IPostSubmitDestination => {
    // The override wins over the Areas flag deliberately. A caller that asked
    // for a specific destination wants it in every build; letting a feature flag
    // outrank it would make the journal's goal flow land on a feed in one app
    // and the profile in another.
    if (returnToRoute) {
        return { route: returnToRoute, params: returnToRouteParams };
    }

    if (isAreasEnabled) {
        return { route: 'Areas' };
    }

    return {
        route: 'ViewUser',
        params: { userInView: { id: userId } },
    };
};

export default getPostSubmitDestination;
