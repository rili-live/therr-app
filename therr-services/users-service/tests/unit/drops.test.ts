import { expect } from 'chai';
import {
    DROP_DEFAULT_UNLOCK_RADIUS_METERS,
    DROP_MAX_ACCURACY_ALLOWANCE_METERS,
    DROP_MAX_RECIPIENTS,
    DROP_MAX_UNLOCK_RADIUS_METERS,
    DROP_MIN_UNLOCK_RADIUS_METERS,
    IDropRow,
    clampUnlockRadius,
    decideOpenDrop,
    getDropStatus,
    isOwnMediaPath,
    isValidCoordinatePair,
    serializeDrop,
    toOpenedOn,
    validateCreateDrop,
} from '../../src/utilities/drops';

/**
 * Drops (docs/DROPS.md). The two failures that matter are privacy failures — a recipient reading
 * a drop's content before going there, or anyone else reading it at all — and both are decided
 * here, so they are pinned here.
 */

const SENDER = '11111111-1111-4111-8111-111111111111';
const RECIPIENT = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-21T12:00:00.000Z');

// Millennium Park, Chicago.
const DROP_LAT = 41.8826;
const DROP_LNG = -87.6226;
// ~0.0009 degrees of latitude is ~100m.
const METERS_PER_DEGREE_LAT = 111_195;

const buildDrop = (overrides: Partial<IDropRow> = {}): IDropRow => ({
    id: '44444444-4444-4444-8444-444444444444',
    brandVariation: 'therr',
    batchId: '55555555-5555-4555-8555-555555555555',
    fromUserId: SENDER,
    toUserId: RECIPIENT,
    message: 'Look up at the bean',
    mediaPath: `${SENDER}/drops/photo.jpg`,
    mediaType: 'user-image-private',
    latitude: DROP_LAT,
    longitude: DROP_LNG,
    unlockRadiusMeters: 100,
    placeName: 'the bean',
    spaceId: null,
    expiresAt: new Date('2026-12-21T12:00:00.000Z'),
    openedAt: null,
    recipientDismissedAt: null,
    createdAt: new Date('2026-11-20T12:00:00.000Z'),
    updatedAt: new Date('2026-11-20T12:00:00.000Z'),
    ...overrides,
});

const metersNorth = (meters: number) => ({
    latitude: DROP_LAT + meters / METERS_PER_DEGREE_LAT,
    longitude: DROP_LNG,
});

describe('drops', () => {
    describe('clampUnlockRadius', () => {
        it('defaults a missing or non-numeric radius', () => {
            expect(clampUnlockRadius(undefined)).to.equal(DROP_DEFAULT_UNLOCK_RADIUS_METERS);
            expect(clampUnlockRadius('far')).to.equal(DROP_DEFAULT_UNLOCK_RADIUS_METERS);
        });

        it('never goes below the GPS-safe minimum or above the maximum', () => {
            expect(clampUnlockRadius(20)).to.equal(DROP_MIN_UNLOCK_RADIUS_METERS);
            expect(clampUnlockRadius(10_000)).to.equal(DROP_MAX_UNLOCK_RADIUS_METERS);
            expect(clampUnlockRadius(150)).to.equal(150);
        });
    });

    describe('isValidCoordinatePair', () => {
        it('accepts a real point and rejects missing, out-of-range and null-island input', () => {
            expect(isValidCoordinatePair(DROP_LAT, DROP_LNG)).to.equal(true);
            expect(isValidCoordinatePair(undefined, DROP_LNG)).to.equal(false);
            expect(isValidCoordinatePair('', '')).to.equal(false);
            expect(isValidCoordinatePair(91, 0)).to.equal(false);
            expect(isValidCoordinatePair(0, 0)).to.equal(false);
        });
    });

    describe('isOwnMediaPath', () => {
        it('only accepts objects under the sender\'s own prefix', () => {
            expect(isOwnMediaPath(`${SENDER}/drops/a.jpg`, SENDER)).to.equal(true);
            expect(isOwnMediaPath(`${STRANGER}/drops/a.jpg`, SENDER)).to.equal(false);
            expect(isOwnMediaPath(`${SENDER}/../${STRANGER}/a.jpg`, SENDER)).to.equal(false);
            expect(isOwnMediaPath(undefined, SENDER)).to.equal(false);
        });
    });

    describe('getDropStatus', () => {
        it('is opened once opened, even after it would have expired', () => {
            expect(getDropStatus(buildDrop({
                openedAt: new Date('2026-11-21T00:00:00Z'),
                expiresAt: new Date('2026-11-01T00:00:00Z'),
            }), NOW)).to.equal('opened');
        });

        it('is expired past its expiry and locked before it', () => {
            expect(getDropStatus(buildDrop({ expiresAt: new Date('2026-11-21T11:59:59Z') }), NOW)).to.equal('expired');
            expect(getDropStatus(buildDrop(), NOW)).to.equal('locked');
        });
    });

    describe('decideOpenDrop', () => {
        it('opens for the recipient standing inside the radius', () => {
            expect(decideOpenDrop(buildDrop(), RECIPIENT, metersNorth(60), NOW)).to.deep.equal({ allowed: true });
        });

        it('refuses the recipient outside the radius and says roughly how far away they are', () => {
            const decision = decideOpenDrop(buildDrop(), RECIPIENT, metersNorth(400), NOW);

            expect(decision.allowed).to.equal(false);
            expect(decision.refusal).to.equal('tooFar');
            expect(decision.distanceMeters).to.be.within(390, 410);
        });

        it('forgives the device\'s reported inaccuracy, but only up to the cap', () => {
            const justOutside = metersNorth(130);

            expect(decideOpenDrop(buildDrop(), RECIPIENT, { ...justOutside, accuracy: 40 }, NOW).allowed).to.equal(true);
            expect(decideOpenDrop(buildDrop(), RECIPIENT, justOutside, NOW).allowed).to.equal(false);
            // A client claiming a huge error bar gets the cap, not a free pass.
            const farAway = metersNorth(100 + DROP_MAX_ACCURACY_ALLOWANCE_METERS + 50);
            expect(decideOpenDrop(buildDrop(), RECIPIENT, { ...farAway, accuracy: 100_000 }, NOW).allowed).to.equal(false);
        });

        it('answers notFound to the sender and to strangers, so ids cannot be probed', () => {
            expect(decideOpenDrop(buildDrop(), SENDER, metersNorth(0), NOW).refusal).to.equal('notFound');
            expect(decideOpenDrop(buildDrop(), STRANGER, metersNorth(0), NOW).refusal).to.equal('notFound');
            expect(decideOpenDrop(undefined, RECIPIENT, metersNorth(0), NOW).refusal).to.equal('notFound');
        });

        it('treats a dismissed drop as gone', () => {
            const dismissed = buildDrop({ recipientDismissedAt: NOW });
            expect(decideOpenDrop(dismissed, RECIPIENT, metersNorth(0), NOW).refusal).to.equal('notFound');
        });

        it('refuses an expired drop and a request with no usable location', () => {
            const expired = buildDrop({ expiresAt: new Date('2026-11-01T00:00:00Z') });
            expect(decideOpenDrop(expired, RECIPIENT, metersNorth(0), NOW).refusal).to.equal('expired');
            expect(decideOpenDrop(buildDrop(), RECIPIENT, { latitude: undefined, longitude: undefined }, NOW).refusal)
                .to.equal('invalidLocation');
        });

        it('lets the recipient re-read an opened drop from anywhere', () => {
            const opened = buildDrop({ openedAt: new Date('2026-11-21T09:00:00Z') });
            expect(decideOpenDrop(opened, RECIPIENT, { latitude: undefined, longitude: undefined }, NOW).allowed).to.equal(true);
        });
    });

    describe('serializeDrop', () => {
        const privateMediaBaseUrl = 'https://images.example/private/';

        it('withholds the message and photo from the recipient while the drop is locked', () => {
            const serialized = serializeDrop(buildDrop(), RECIPIENT, { privateMediaBaseUrl, now: NOW });

            expect(serialized?.status).to.equal('locked');
            expect(serialized?.message).to.equal(null);
            expect(serialized?.mediaUrl).to.equal(null);
            // Enough to go there.
            expect(serialized?.hasMedia).to.equal(true);
            expect(serialized?.placeName).to.equal('the bean');
            expect(serialized?.latitude).to.equal(DROP_LAT);
            // The raw path never leaves the server: it resolves to the image.
            expect(JSON.stringify(serialized)).to.not.contain('drops/photo.jpg');
        });

        it('shows the recipient everything once opened', () => {
            const opened = buildDrop({ openedAt: new Date('2026-11-21T09:15:00Z') });
            const serialized = serializeDrop(opened, RECIPIENT, { privateMediaBaseUrl, now: NOW });

            expect(serialized?.message).to.equal('Look up at the bean');
            expect(serialized?.mediaUrl).to.equal(`${privateMediaBaseUrl}${SENDER}/drops/photo.jpg`);
        });

        it('always shows the sender their own content', () => {
            const serialized = serializeDrop(buildDrop(), SENDER, { privateMediaBaseUrl, now: NOW });

            expect(serialized?.isSender).to.equal(true);
            expect(serialized?.message).to.equal('Look up at the bean');
            expect(serialized?.mediaUrl).to.not.equal(null);
        });

        it('reports only the day it was opened, never the time', () => {
            const opened = buildDrop({ openedAt: new Date('2026-11-21T09:15:42Z') });
            const serialized = serializeDrop(opened, SENDER, { now: NOW });

            expect(serialized?.openedOn).to.equal('2026-11-21');
            expect(JSON.stringify(serialized)).to.not.contain('09:15');
            expect(toOpenedOn(null)).to.equal(null);
        });

        it('returns nothing for a stranger, or for a recipient who dismissed it', () => {
            expect(serializeDrop(buildDrop(), STRANGER, { now: NOW })).to.equal(null);
            expect(serializeDrop(buildDrop({ recipientDismissedAt: NOW }), RECIPIENT, { now: NOW })).to.equal(null);
        });

        it('leaves the URL out when the deployment has no private image base configured', () => {
            const serialized = serializeDrop(buildDrop(), SENDER, { now: NOW });
            expect(serialized?.mediaUrl).to.equal(null);
            expect(serialized?.hasMedia).to.equal(true);
        });
    });

    describe('validateCreateDrop', () => {
        const valid = {
            recipientIds: [RECIPIENT],
            message: '  Look up at the bean  ',
            latitude: DROP_LAT,
            longitude: DROP_LNG,
            placeName: 'the bean',
        };

        it('normalizes a valid request', () => {
            const { value, error } = validateCreateDrop(valid, SENDER);

            expect(error).to.equal(undefined);
            expect(value?.message).to.equal('Look up at the bean');
            expect(value?.unlockRadiusMeters).to.equal(DROP_DEFAULT_UNLOCK_RADIUS_METERS);
            expect(value?.mediaPath).to.equal(null);
        });

        it('de-duplicates recipients and drops malformed ids', () => {
            const { value } = validateCreateDrop({ ...valid, recipientIds: [RECIPIENT, RECIPIENT, 'not-a-uuid'] }, SENDER);
            expect(value?.recipientIds).to.deep.equal([RECIPIENT]);
        });

        it('rejects requests that cannot be a drop', () => {
            expect(validateCreateDrop({ ...valid, recipientIds: [] }, SENDER).error).to.equal('noRecipients');
            expect(validateCreateDrop({ ...valid, recipientIds: [SENDER] }, SENDER).error).to.equal('cannotDropForSelf');
            expect(validateCreateDrop({ ...valid, message: '' }, SENDER).error).to.equal('emptyDrop');
            expect(validateCreateDrop({ ...valid, message: 'x'.repeat(501) }, SENDER).error).to.equal('messageTooLong');
            expect(validateCreateDrop({ ...valid, latitude: 0, longitude: 0 }, SENDER).error).to.equal('invalidLocation');
            const tooMany = Array.from({ length: DROP_MAX_RECIPIENTS + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
            expect(validateCreateDrop({ ...valid, recipientIds: tooMany }, SENDER).error).to.equal('tooManyRecipients');
        });

        it('accepts a photo-only drop, but only with the sender\'s own media', () => {
            const photoOnly = { ...valid, message: '', media: { path: `${SENDER}/drops/a.jpg`, type: 'user-image-private' } };
            expect(validateCreateDrop(photoOnly, SENDER).value?.mediaPath).to.equal(`${SENDER}/drops/a.jpg`);

            const someoneElses = { ...photoOnly, media: { path: `${STRANGER}/a.jpg`, type: 'user-image-private' } };
            expect(validateCreateDrop(someoneElses, SENDER).error).to.equal('invalidMedia');
        });
    });
});
