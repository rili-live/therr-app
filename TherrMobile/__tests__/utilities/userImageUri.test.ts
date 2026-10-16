// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { getUserImageUri } from '../../main/utilities/content';

/**
 * Default (robohash) avatars
 *
 * Robohash draws the avatar from the URL path, so a caller that hands over a row keyed by
 * `userId` instead of `id` produced `robohash.org/undefined` — one identical robot for every
 * Friends with Habits user who had not uploaded a photo, most visibly on the leaderboard.
 */

jest.mock('therr-react/services', () => ({
    MapsService: {},
}));

jest.mock('../../main/utilities/getConfig', () => () => ({
    baseImageKitEndpoint: 'https://images.example/',
}));

describe('getUserImageUri', () => {
    it('seeds the default avatar with the user id', () => {
        expect(getUserImageUri({ details: { id: 'u1' } }, 100))
            .toBe('https://robohash.org/u1?set=set5&size=100x100');
    });

    it('falls back to userId for rows that are not keyed by id', () => {
        expect(getUserImageUri({ details: { userId: 'u2' } }, 100))
            .toBe('https://robohash.org/u2?set=set5&size=100x100');
    });

    it('gives two different users two different default avatars', () => {
        expect(getUserImageUri({ details: { userId: 'u1' } }, 100))
            .not.toBe(getUserImageUri({ details: { userId: 'u2' } }, 100));
    });

    it('prefers an uploaded profile picture', () => {
        expect(getUserImageUri({ details: { id: 'u1', media: { profilePicture: { path: 'u1/p.jpg' } } } }, 100))
            .toBe('https://images.example/u1/p.jpg?tr=h-100,w-100,f-auto,q-90');
    });
});
