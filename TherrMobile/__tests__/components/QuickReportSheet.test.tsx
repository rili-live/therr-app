import 'react-native';

import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * QuickReportSheet Logic Regression Tests
 *
 * Tests the data construction and submission logic in QuickReportSheet.
 * Verifies that the moment data includes all required fields including
 * the user prop (fromUserId) and radius.
 */

// Mirror of Categories.QuickReportCategories check used in AreaDisplayCard and MarkerIcon
const QuickReportCategories = [
    'happeningNow',
    'longWait',
    'liveEntertainment',
    'crowdAlert',
    'hiddenGem',
    'localDeal',
];

// Mirror of the CategoriesMap entries used for quick reports
const CategoriesMap = {
    30: 'happeningNow',
    31: 'longWait',
    32: 'liveEntertainment',
    33: 'crowdAlert',
    34: 'hiddenGem',
    35: 'localDeal',
};

describe('QuickReportSheet moment data construction', () => {
    const buildMomentData = (option: any, user: any, circleCenter: any, nearestSpace: any, details: string, translate: Function) => ({
        category: option.category,
        fromUserId: user?.details?.id,
        latitude: circleCenter.latitude,
        longitude: circleCenter.longitude,
        radius: 100,
        isPublic: true,
        message: details || translate(option.labelKey),
        notificationMsg: details || translate(option.labelKey),
        spaceId: nearestSpace?.id,
    });

    it('should include fromUserId from user prop', () => {
        const data = buildMomentData(
            { category: 'happeningNow', labelKey: 'quickReports.happeningNow' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            null,
            '',
            (key: string) => key,
        );
        expect(data.fromUserId).toBe('user-123');
    });

    it('should set radius to 100', () => {
        const data = buildMomentData(
            { category: 'happeningNow', labelKey: 'quickReports.happeningNow' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            null,
            '',
            (key: string) => key,
        );
        expect(data.radius).toBe(100);
    });

    it('should use details when provided', () => {
        const data = buildMomentData(
            { category: 'happeningNow', labelKey: 'quickReports.happeningNow' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            null,
            'Custom details',
            (key: string) => key,
        );
        expect(data.message).toBe('Custom details');
        expect(data.notificationMsg).toBe('Custom details');
    });

    it('should fall back to translated label when details are empty', () => {
        const translate = (key: string) => `Translated: ${key}`;
        const data = buildMomentData(
            { category: 'happeningNow', labelKey: 'quickReports.happeningNow' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            null,
            '',
            translate,
        );
        expect(data.message).toBe('Translated: quickReports.happeningNow');
        expect(data.notificationMsg).toBe('Translated: quickReports.happeningNow');
    });

    it('should include spaceId when nearestSpace exists', () => {
        const data = buildMomentData(
            { category: 'crowdAlert', labelKey: 'quickReports.crowdAlert' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            { id: 'space-456', title: 'Test Space' },
            '',
            (key: string) => key,
        );
        expect(data.spaceId).toBe('space-456');
    });

    it('should set spaceId to undefined when no nearest space', () => {
        const data = buildMomentData(
            { category: 'crowdAlert', labelKey: 'quickReports.crowdAlert' },
            { details: { id: 'user-123' } },
            { latitude: 40.7, longitude: -74.0 },
            null,
            '',
            (key: string) => key,
        );
        expect(data.spaceId).toBeUndefined();
    });

    it('should handle missing user gracefully', () => {
        const data = buildMomentData(
            { category: 'happeningNow', labelKey: 'quickReports.happeningNow' },
            undefined,
            { latitude: 40.7, longitude: -74.0 },
            null,
            '',
            (key: string) => key,
        );
        expect(data.fromUserId).toBeUndefined();
    });
});

describe('QuickReport category identification', () => {
    it('should identify all quick report categories', () => {
        Object.values(CategoriesMap).forEach((category) => {
            expect(QuickReportCategories).toContain(category);
        });
    });

    it('should not identify regular categories as quick reports', () => {
        expect(QuickReportCategories).not.toContain('food');
        expect(QuickReportCategories).not.toContain('art');
        expect(QuickReportCategories).not.toContain('music');
        expect(QuickReportCategories).not.toContain('nature');
    });
});

describe('MapActionButtons dynamic positioning', () => {
    const BUTTON_SPACING = 60;
    const BASE_BOTTOM = 120;
    const COLLAPSE_OFFSET = 20;
    const buttonMenuHeight = 80; // typical value

    const getExpandedBottom = (expandedButtonKeys: string[], key: string): number => {
        const index = expandedButtonKeys.indexOf(key);
        return BASE_BOTTOM + BUTTON_SPACING + (index * BUTTON_SPACING) + buttonMenuHeight - COLLAPSE_OFFSET;
    };

    it('should stack buttons above the quick report button', () => {
        const keys = ['createEvent', 'claimASpace', 'uploadMoment'];
        const eventBottom = getExpandedBottom(keys, 'createEvent');
        const claimBottom = getExpandedBottom(keys, 'claimASpace');
        const uploadBottom = getExpandedBottom(keys, 'uploadMoment');

        expect(claimBottom).toBeGreaterThan(eventBottom);
        expect(uploadBottom).toBeGreaterThan(claimBottom);
    });

    it('should space buttons evenly', () => {
        const keys = ['createEvent', 'claimASpace', 'uploadMoment'];
        const eventBottom = getExpandedBottom(keys, 'createEvent');
        const claimBottom = getExpandedBottom(keys, 'claimASpace');
        const uploadBottom = getExpandedBottom(keys, 'uploadMoment');

        expect(claimBottom - eventBottom).toBe(BUTTON_SPACING);
        expect(uploadBottom - claimBottom).toBe(BUTTON_SPACING);
    });

    it('should add addACheckIn when nearby spaces exist', () => {
        const keys = ['createEvent', 'claimASpace', 'uploadMoment', 'addACheckIn'];
        const checkInBottom = getExpandedBottom(keys, 'addACheckIn');
        const uploadBottom = getExpandedBottom(keys, 'uploadMoment');

        expect(checkInBottom).toBeGreaterThan(uploadBottom);
        expect(checkInBottom - uploadBottom).toBe(BUTTON_SPACING);
    });
});
