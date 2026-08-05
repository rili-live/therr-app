import { AccessLevels } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';

/**
 * Where a visitor stands in the API key onboarding flow. The /api-access page renders
 * one CTA per stage so nobody is sent to a page they cannot use yet — the previous CTA
 * pointed everyone at a single login URL regardless of account state.
 */
export enum ApiAccessStage {
    UNAUTHENTICATED = 'unauthenticated',
    INCOMPLETE_PROFILE = 'incompleteProfile',
    NOT_A_BUSINESS = 'notABusiness',
    NO_SUBSCRIPTION = 'noSubscription',
    ELIGIBLE = 'eligible',
}

/**
 * Mirrors API_KEY_ELIGIBLE_LEVELS in users-service/handlers/apiKeys.ts. A user without
 * one of these gets a 403 from POST /api-keys, so the page must route them to the
 * subscription step instead of the key generator.
 */
const API_KEY_ELIGIBLE_LEVELS: string[] = [
    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
    AccessLevels.SUPER_ADMIN,
    AccessLevels.API_ACCESS,
];

export const hasApiKeyEligibility = (accessLevels: string[] = []): boolean => API_KEY_ELIGIBLE_LEVELS
    .some((level) => accessLevels.includes(level));

export const getApiAccessStage = (user?: IUserState): ApiAccessStage => {
    const accessLevels: string[] = user?.details?.accessLevels || [];

    if (!user?.isAuthenticated || !accessLevels.length) {
        return ApiAccessStage.UNAUTHENTICATED;
    }

    // A half-registered account cannot claim a business or subscribe. Send them to finish
    // the profile first, otherwise the dashboard bounces them back here.
    if (accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)
        && !accessLevels.includes(AccessLevels.EMAIL_VERIFIED)) {
        return ApiAccessStage.INCOMPLETE_PROFILE;
    }

    // Eligibility is checked before the business-account flag on purpose: super admins and
    // accounts granted API_ACCESS directly should never be told to create a business account.
    if (hasApiKeyEligibility(accessLevels)) {
        return ApiAccessStage.ELIGIBLE;
    }

    if (!user?.details?.isBusinessAccount) {
        return ApiAccessStage.NOT_A_BUSINESS;
    }

    return ApiAccessStage.NO_SUBSCRIPTION;
};

/**
 * The dashboard path each stage should land on after the SSO handoff. Stages that have no
 * dashboard destination (the visitor has no usable dashboard session yet) return undefined
 * and are handled with an in-app link instead.
 */
export const getDashboardTargetPath = (stage: ApiAccessStage): string | undefined => {
    switch (stage) {
        case ApiAccessStage.ELIGIBLE:
            return '/settings/api-keys';
        case ApiAccessStage.NO_SUBSCRIPTION:
            return '/settings';
        default:
            return undefined;
    }
};
