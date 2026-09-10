/**
 * @jest-environment jsdom
 */
import { AccessLevels } from 'therr-js-utilities/constants';
import {
    ApiAccessStage,
    getApiAccessStage,
    getDashboardTargetPath,
    hasApiKeyEligibility,
} from '../utilities/apiAccess';

const buildUser = (details: any = {}, isAuthenticated = true): any => ({
    isAuthenticated,
    details: {
        accessLevels: [AccessLevels.EMAIL_VERIFIED],
        ...details,
    },
});

describe('apiAccess', () => {
    describe('getApiAccessStage', () => {
        it('treats a missing user as unauthenticated', () => {
            expect(getApiAccessStage(undefined)).toBe(ApiAccessStage.UNAUTHENTICATED);
        });

        it('treats an authenticated user with no access levels as unauthenticated', () => {
            // The store briefly holds { isAuthenticated: true, details: {} } during boot;
            // rendering the "eligible" CTA there would send them to a 403.
            expect(getApiAccessStage(buildUser({ accessLevels: [] }))).toBe(ApiAccessStage.UNAUTHENTICATED);
        });

        it('routes a half-registered account to the profile step', () => {
            const user = buildUser({
                accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            });
            expect(getApiAccessStage(user)).toBe(ApiAccessStage.INCOMPLETE_PROFILE);
        });

        it('does not treat a fully verified account as half-registered', () => {
            const user = buildUser({
                accessLevels: [
                    AccessLevels.EMAIL_VERIFIED,
                    AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
                ],
                isBusinessAccount: true,
            });
            expect(getApiAccessStage(user)).toBe(ApiAccessStage.NO_SUBSCRIPTION);
        });

        it('routes a personal profile to the business account step', () => {
            expect(getApiAccessStage(buildUser({ isBusinessAccount: false }))).toBe(ApiAccessStage.NOT_A_BUSINESS);
        });

        it('routes an unsubscribed business account to the subscription step', () => {
            const user = buildUser({ isBusinessAccount: true });
            expect(getApiAccessStage(user)).toBe(ApiAccessStage.NO_SUBSCRIPTION);
        });

        it.each([
            AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
            AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
            AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
            AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
            AccessLevels.API_ACCESS,
        ])('marks a %s subscriber as eligible', (level) => {
            const user = buildUser({
                accessLevels: [AccessLevels.EMAIL_VERIFIED, level],
                isBusinessAccount: true,
            });
            expect(getApiAccessStage(user)).toBe(ApiAccessStage.ELIGIBLE);
        });

        it('marks an eligible account as eligible even without the business flag', () => {
            // Super admins and directly-granted API_ACCESS users can create keys; telling
            // them to go register a business account would be a dead end.
            const user = buildUser({
                accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
                isBusinessAccount: false,
            });
            expect(getApiAccessStage(user)).toBe(ApiAccessStage.ELIGIBLE);
        });
    });

    describe('hasApiKeyEligibility', () => {
        it('defaults to false with no access levels', () => {
            expect(hasApiKeyEligibility()).toBe(false);
            expect(hasApiKeyEligibility([])).toBe(false);
        });

        it('ignores unrelated access levels', () => {
            expect(hasApiKeyEligibility([AccessLevels.EMAIL_VERIFIED])).toBe(false);
        });
    });

    describe('getDashboardTargetPath', () => {
        it('sends eligible users straight to the key generator', () => {
            expect(getDashboardTargetPath(ApiAccessStage.ELIGIBLE)).toBe('/settings/api-keys');
        });

        it('sends unsubscribed business accounts to settings', () => {
            expect(getDashboardTargetPath(ApiAccessStage.NO_SUBSCRIPTION)).toBe('/settings');
        });

        it.each([
            ApiAccessStage.UNAUTHENTICATED,
            ApiAccessStage.INCOMPLETE_PROFILE,
            ApiAccessStage.NOT_A_BUSINESS,
        ])('has no dashboard destination for %s', (stage) => {
            // These stages have no usable dashboard session, so the page must not
            // attempt an SSO handoff for them.
            expect(getDashboardTargetPath(stage)).toBeUndefined();
        });
    });
});
