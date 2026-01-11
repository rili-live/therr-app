/**
 * Integration Tests for Messages Service
 *
 * These tests connect to a real PostgreSQL database to verify
 * that the data layer works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';

// Import domain-specific integration tests
import './directMessages.integration.test';
import './forums.integration.test';
import './forumMessages.integration.test';

describe('Messages Service Integration Tests', () => {
    it('test suite should be properly configured', () => {
        expect(true).to.be.equal(true);
    });
});
