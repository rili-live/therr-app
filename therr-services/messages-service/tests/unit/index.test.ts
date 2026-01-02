/**
 * Unit Tests for Messages Service
 *
 * Test coverage for stores, handlers, and utilities.
 *
 * Run: npm run test:unit
 */
import { expect } from 'chai';

// Store tests
import './DirectMessagesStore.test';
import './ForumsStore.test';
import './ForumMessagesStore.test';

// Handler tests
import './handlers-directMessages.test';
import './handlers-forums.test';
import './handlers-forumMessages.test';

// Utility tests
import './contentSafety.test';

describe('Messages Service Unit Tests', () => {
    it('test suite should be properly configured', () => {
        expect(true).to.be.equal(true);
    });
});
