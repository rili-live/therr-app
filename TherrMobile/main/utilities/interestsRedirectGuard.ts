let hasBypassed = false;

export const hasBypassedInterestsRedirect = (): boolean => hasBypassed;

export const bypassInterestsRedirect = (): void => {
    hasBypassed = true;
};

export const resetInterestsRedirectBypass = (): void => {
    hasBypassed = false;
};
