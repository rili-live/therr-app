/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import { isTextUnsafe } from '../../src/utilities/contentSafety';

describe('Content Safety Utility', () => {
    describe('isTextUnsafe', () => {
        it('should return false for safe text', () => {
            const result = isTextUnsafe(['Hello world', 'This is a friendly message']);
            expect(result).to.be.eq(false);
        });

        it('should return true for text containing profanity', () => {
            const result = isTextUnsafe(['This contains a bad word: shit']);
            expect(result).to.be.eq(true);
        });

        it('should return true when any text in array is unsafe', () => {
            const result = isTextUnsafe([
                'This is safe',
                'This contains damn word',
                'This is also safe',
            ]);
            expect(result).to.be.eq(true);
        });

        it('should return false for empty array', () => {
            const result = isTextUnsafe([]);
            expect(result).to.be.eq(false);
        });

        it('should return false for array with empty strings', () => {
            const result = isTextUnsafe(['', '', '']);
            expect(result).to.be.eq(false);
        });

        it('should detect custom added words like sexting', () => {
            const result = isTextUnsafe(['This mentions sexting inappropriately']);
            expect(result).to.be.eq(true);
        });

        it('should detect custom added phrase jerk off', () => {
            const result = isTextUnsafe(['Some inappropriate content jerk off']);
            expect(result).to.be.eq(true);
        });

        it('should handle mixed safe and empty strings', () => {
            const result = isTextUnsafe(['Hello', '', 'World']);
            expect(result).to.be.eq(false);
        });

        it('should be case insensitive for profanity detection', () => {
            const result = isTextUnsafe(['This contains SHIT']);
            expect(result).to.be.eq(true);
        });

        it('should detect multiple profanity words in same text', () => {
            const result = isTextUnsafe(['What the hell and damn']);
            expect(result).to.be.eq(true);
        });

        it('should return false for safe forum title', () => {
            const result = isTextUnsafe(['Tech Discussion Group']);
            expect(result).to.be.eq(false);
        });

        it('should return false for safe forum description', () => {
            const result = isTextUnsafe([
                'Tech Discussion',
                'A place to discuss technology',
                'Share your knowledge and learn from others',
            ]);
            expect(result).to.be.eq(false);
        });

        it('should return true for inappropriate forum content', () => {
            const result = isTextUnsafe([
                'Adult Group',
                'Sexting and more',
                'Come join us',
            ]);
            expect(result).to.be.eq(true);
        });

        it('should handle typical forum content safely', () => {
            const result = isTextUnsafe([
                'JavaScript Developers',
                'Discussion about JS frameworks',
                'React, Vue, Angular and more',
            ]);
            expect(result).to.be.eq(false);
        });

        it('should handle unicode text', () => {
            const result = isTextUnsafe(['Hello 世界', 'Bonjour le monde']);
            expect(result).to.be.eq(false);
        });

        it('should handle special characters', () => {
            const result = isTextUnsafe(['Hello! @#$%^&*()']);
            expect(result).to.be.eq(false);
        });
    });
});
