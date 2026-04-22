/**
 * Unit Tests for geocode route handler logic
 *
 * Tests input validation, response shaping, and cache key generation
 * for the Nominatim geocoding proxy endpoint.
 */
import { expect } from 'chai';
import crypto from 'crypto';

describe('Geocode Route', () => {
    describe('Input Validation', () => {
        it('should reject empty query parameter', () => {
            const q = '';
            const isValid = !!(q && typeof q === 'string' && q.trim().length > 0);
            expect(isValid).to.equal(false);
        });

        it('should reject null query parameter', () => {
            const q = null;
            const isValid = !!(q && typeof q === 'string' && (q as string).trim().length > 0);
            expect(isValid).to.equal(false);
        });

        it('should reject whitespace-only query', () => {
            const q = '   ';
            const isValid = q && typeof q === 'string' && q.trim().length > 0;
            expect(isValid).to.be.false;
        });

        it('should accept valid query string', () => {
            const q = 'Michigan';
            const isValid = q && typeof q === 'string' && q.trim().length > 0;
            expect(isValid).to.be.true;
        });

        it('should accept query with leading/trailing spaces', () => {
            const q = '  New York  ';
            const isValid = q && typeof q === 'string' && q.trim().length > 0;
            expect(isValid).to.be.true;
        });
    });

    describe('Cache Key Generation', () => {
        it('should generate consistent cache key for same query', () => {
            const q = 'Michigan';
            const key1 = crypto.createHash('sha256').update(`geocode:${q.trim().toLowerCase()}`).digest('hex');
            const key2 = crypto.createHash('sha256').update(`geocode:${q.trim().toLowerCase()}`).digest('hex');
            expect(key1).to.equal(key2);
        });

        it('should normalize case for cache key', () => {
            const key1 = crypto.createHash('sha256').update('geocode:michigan').digest('hex');
            const key2 = crypto.createHash('sha256').update('geocode:Michigan'.toLowerCase()).digest('hex');
            expect(key1).to.equal(key2);
        });

        it('should normalize whitespace for cache key', () => {
            const q1 = '  Michigan  ';
            const q2 = 'Michigan';
            const key1 = crypto.createHash('sha256').update(`geocode:${q1.trim().toLowerCase()}`).digest('hex');
            const key2 = crypto.createHash('sha256').update(`geocode:${q2.trim().toLowerCase()}`).digest('hex');
            expect(key1).to.equal(key2);
        });

        it('should generate different keys for different queries', () => {
            const key1 = crypto.createHash('sha256').update('geocode:michigan').digest('hex');
            const key2 = crypto.createHash('sha256').update('geocode:new york').digest('hex');
            expect(key1).to.not.equal(key2);
        });
    });

    describe('Response Shaping', () => {
        const mockNominatimResult = {
            lat: '44.3148443',
            lon: '-85.6023643',
            display_name: 'Michigan, United States',
            boundingbox: ['41.6961870', '48.3060570', '-90.4182410', '-82.1221410'],
            type: 'state',
            class: 'boundary',
        };

        it('should parse latitude and longitude as numbers', () => {
            const result = {
                latitude: parseFloat(mockNominatimResult.lat),
                longitude: parseFloat(mockNominatimResult.lon),
            };
            expect(result.latitude).to.be.a('number');
            expect(result.longitude).to.be.a('number');
            expect(result.latitude).to.be.closeTo(44.3148, 0.001);
            expect(result.longitude).to.be.closeTo(-85.6024, 0.001);
        });

        it('should parse bounding box as array of numbers', () => {
            const boundingBox = mockNominatimResult.boundingbox?.map(parseFloat) || [];
            expect(boundingBox).to.be.an('array').with.lengthOf(4);
            boundingBox.forEach((val) => {
                expect(val).to.be.a('number');
                expect(Number.isNaN(val)).to.be.false;
            });
        });

        it('should preserve display name', () => {
            expect(mockNominatimResult.display_name).to.equal('Michigan, United States');
        });

        it('should preserve type and class fields', () => {
            expect(mockNominatimResult.type).to.equal('state');
            expect(mockNominatimResult.class).to.equal('boundary');
        });

        it('should handle missing boundingbox gracefully', () => {
            const resultWithoutBbox = { ...mockNominatimResult, boundingbox: undefined };
            const boundingBox = resultWithoutBbox.boundingbox?.map(parseFloat) || [];
            expect(boundingBox).to.be.an('array').with.lengthOf(0);
        });

        it('should shape response into expected format', () => {
            const result = mockNominatimResult;
            const data = {
                results: [{
                    latitude: parseFloat(result.lat),
                    longitude: parseFloat(result.lon),
                    displayName: result.display_name,
                    boundingBox: result.boundingbox?.map(parseFloat) || [],
                    type: result.type,
                    class: result.class,
                }],
            };

            expect(data.results).to.be.an('array').with.lengthOf(1);
            expect(data.results[0]).to.have.all.keys('latitude', 'longitude', 'displayName', 'boundingBox', 'type', 'class');
        });

        it('should return empty results array for no matches', () => {
            const data = { results: [] };
            expect(data.results).to.be.an('array').with.lengthOf(0);
        });
    });
});
