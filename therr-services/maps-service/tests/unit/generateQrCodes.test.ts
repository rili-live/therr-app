/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import { buildCheckinQrUrl, SPACES_BASE_URL } from '../../src/scripts/generate-qr-codes';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generate-qr-codes', () => {
    describe('SPACES_BASE_URL', () => {
        it('uses the therr.com production domain', () => {
            expect(SPACES_BASE_URL).to.include('therr.com');
        });

        it('uses https scheme', () => {
            expect(SPACES_BASE_URL).to.match(/^https:\/\//);
        });

        it('ends with /spaces path segment', () => {
            expect(SPACES_BASE_URL).to.match(/\/spaces$/);
        });
    });

    describe('buildCheckinQrUrl', () => {
        const sampleSpaceId = '550e8400-e29b-41d4-a716-446655440000';

        it('returns a valid https URL', () => {
            const url = buildCheckinQrUrl(sampleSpaceId);
            expect(url).to.match(/^https:\/\//);
        });

        it('encodes the spaceId in the URL path', () => {
            const url = buildCheckinQrUrl(sampleSpaceId);
            expect(url).to.include(`/spaces/${sampleSpaceId}`);
        });

        it('appends checkin=true query param', () => {
            const url = buildCheckinQrUrl(sampleSpaceId);
            const parsed = new URL(url);
            expect(parsed.searchParams.get('checkin')).to.equal('true');
        });

        it('produces URLs routable by the web app /spaces/:spaceId route', () => {
            const url = buildCheckinQrUrl(sampleSpaceId);
            const parsed = new URL(url);
            // Must match the web app route pattern: /spaces/:spaceId
            expect(parsed.pathname).to.match(/^\/spaces\/[0-9a-f-]+$/i);
        });

        it('does not add extra query params beyond checkin', () => {
            const url = buildCheckinQrUrl(sampleSpaceId);
            const parsed = new URL(url);
            expect([...parsed.searchParams.keys()]).to.deep.equal(['checkin']);
        });

        it('produces a unique URL per spaceId', () => {
            const id1 = '550e8400-e29b-41d4-a716-446655440000';
            const id2 = '660f9511-f3ac-52e5-b827-557766551111';
            expect(buildCheckinQrUrl(id1)).to.not.equal(buildCheckinQrUrl(id2));
        });

        it('handles any UUID v4 without throwing', () => {
            const randomishId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
            expect(UUID_V4_REGEX.test(randomishId)).to.be.true;
            const url = buildCheckinQrUrl(randomishId);
            expect(url).to.be.a('string').and.to.not.be.empty;
        });
    });
});
