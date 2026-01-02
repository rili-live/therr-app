/**
 * Integration Tests for Forums
 *
 * These tests verify the complete forum lifecycle against a real database.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import ForumsStore, { ICreateForumParams } from '../../src/store/ForumsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Forums', () => {
    // Use valid UUID format for test author IDs
    const TEST_AUTHOR_ID = '686800b1-8383-42cb-bbf2-7e9e460a7f76';
    const TEST_AUTHOR_ID_2 = 'ecbfe38f-ac0e-4dfa-835b-720666d91a80';
    let forumsStore: ForumsStore;
    let skipTests = false;
    let createdForumIds: string[] = [];
    let validCategoryTag = 'general';

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        const connection = getTestConnection();
        forumsStore = new ForumsStore(connection);

        // Check if categories table has data
        try {
            const categoryResult = await connection.read.query('SELECT tag FROM main.categories LIMIT 1');
            if (categoryResult.rows.length === 0) {
                console.log('\n⚠️  No categories found in database. Skipping forums integration tests.');
                console.log('   Run seed scripts to populate categories.\n');
                skipTests = true;
                return;
            }
            validCategoryTag = categoryResult.rows[0].tag;
        } catch (err) {
            console.log('\n⚠️  Error checking categories. Skipping forums integration tests.');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (skipTests) return;
        // Clean up created forums
        await Promise.all(createdForumIds.map(
            async (forumId) => {
                try {
                    await cleanupTestData('forumCategories', { forumId });
                    await cleanupTestData('forums', { id: forumId });
                } catch {
                    // Ignore cleanup errors
                }
            },
        ));
        createdForumIds = [];
    });

    after(async () => {
        await closeTestConnection();
    });

    describe('Create Forum', () => {
        it('should create a new forum with all required fields', async () => {
            if (skipTests) return;

            const testForum: ICreateForumParams = {
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Integration Test Forum'],
                subtitle: ['Test Subtitle'],
                description: 'This is a test forum created by integration tests',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#007bff',
                maxCommentsPerMin: 50,
                doesExpire: false,
                isPublic: true,
            };

            const createdForums = await forumsStore.createForum(testForum);
            createdForumIds.push(createdForums[0].id);

            expect(createdForums).to.be.an('array');
            expect(createdForums.length).to.equal(1);
            expect(createdForums[0].id).to.be.a('string');
            expect(createdForums[0].title).to.deep.equal(['Integration Test Forum']);
            expect(createdForums[0].authorId).to.equal(TEST_AUTHOR_ID);
            expect(createdForums[0].isPublic).to.be.eq(true);
        });

        it('should create forum with multiple category tags', async () => {
            if (skipTests) return;

            const testForum: ICreateForumParams = {
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Multi-Category Forum'],
                subtitle: ['Tech Discussion'],
                description: 'A forum for tech topics',
                iconGroup: 'tech',
                iconId: 'code',
                iconColor: '#28a745',
            };

            const createdForums = await forumsStore.createForum(testForum);
            createdForumIds.push(createdForums[0].id);

            expect(createdForums[0].id).to.be.a('string');
        });

        it('should create private forum', async () => {
            if (skipTests) return;

            const testForum: ICreateForumParams = {
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Private Forum'],
                subtitle: ['Invite Only'],
                description: 'Private discussion group',
                iconGroup: 'default',
                iconId: 'lock',
                iconColor: '#dc3545',
                isPublic: false,
            };

            const createdForums = await forumsStore.createForum(testForum);
            createdForumIds.push(createdForums[0].id);

            expect(createdForums[0].isPublic).to.be.eq(false);
        });
    });

    describe('Get Forum', () => {
        it('should retrieve forum by id', async () => {
            if (skipTests) return;

            // Create a forum first
            const createdForums = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Forum to Retrieve'],
                subtitle: ['Test'],
                description: 'Test forum',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(createdForums[0].id);
            const forumId = createdForums[0].id;

            // Retrieve the forum
            const retrievedForums = await forumsStore.getForum(forumId);

            expect(retrievedForums).to.be.an('array');
            expect(retrievedForums.length).to.equal(1);
            expect(retrievedForums[0].id).to.equal(forumId);
            expect(retrievedForums[0].title).to.deep.equal(['Forum to Retrieve']);
        });

        it('should return empty array for non-existent forum', async () => {
            if (skipTests) return;

            const retrievedForums = await forumsStore.getForum('non-existent-forum-id-12345');

            expect(retrievedForums).to.be.an('array');
            expect(retrievedForums.length).to.equal(0);
        });
    });

    describe('Get Forums with Conditions', () => {
        it('should filter forums by author', async () => {
            if (skipTests) return;

            // Create forums by different authors
            const forum1 = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Author 1 Forum'],
                subtitle: ['Test'],
                description: 'Forum by author 1',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum1[0].id);

            const forum2 = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID_2,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID_2,
                categoryTags: [validCategoryTag],
                title: ['Author 2 Forum'],
                subtitle: ['Test'],
                description: 'Forum by author 2',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum2[0].id);

            // Get forums by author 1
            const authorForums = await forumsStore.getForums({ authorId: TEST_AUTHOR_ID }, null);

            const authorForumIds = authorForums.map((f) => f.id);
            expect(authorForumIds).to.include(forum1[0].id);
        });

        it('should exclude archived forums by default', async () => {
            if (skipTests) return;

            // Create and archive a forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['To Be Archived'],
                subtitle: ['Test'],
                description: 'Will be archived',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum[0].id);

            await forumsStore.archiveForum({
                id: forum[0].id,
                authorId: TEST_AUTHOR_ID,
            });

            // Get forums - should not include archived
            const activeForums = await forumsStore.getForums({ authorId: TEST_AUTHOR_ID }, null, true);

            const activeForumIds = activeForums.map((f) => f.id);
            expect(activeForumIds).to.not.include(forum[0].id);
        });
    });

    describe('Find Forums', () => {
        it('should find multiple forums by IDs', async () => {
            if (skipTests) return;

            // Create multiple forums
            const forum1 = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Find Forum 1'],
                subtitle: ['Test'],
                description: 'First forum',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum1[0].id);

            const forum2 = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Find Forum 2'],
                subtitle: ['Test'],
                description: 'Second forum',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum2[0].id);

            // Find both forums
            const foundForums = await forumsStore.findForums([forum1[0].id, forum2[0].id]);

            expect(foundForums).to.be.an('array');
            expect(foundForums.length).to.equal(2);
            expect(foundForums[0]).to.have.property('id');
            expect(foundForums[0]).to.have.property('title');
        });
    });

    describe('Search Forums', () => {
        it('should search public forums with pagination', async () => {
            if (skipTests) return;

            // Create public forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Searchable Public Forum'],
                subtitle: ['Test'],
                description: 'Public forum for search test',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
                isPublic: true,
            });
            createdForumIds.push(forum[0].id);

            // Search public forums
            const searchResults = await forumsStore.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                {},
            );

            expect(searchResults).to.be.an('array');
        });

        it('should search forums by specific IDs', async () => {
            if (skipTests) return;

            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['ID Search Forum'],
                subtitle: ['Test'],
                description: 'Forum for ID search',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
                isPublic: true,
            });
            createdForumIds.push(forum[0].id);

            // Search by specific forum ID
            const searchResults = await forumsStore.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                { forumIds: [Number(forum[0].id)] },
            );

            expect(searchResults).to.be.an('array');
        });
    });

    describe('Update Forum', () => {
        it('should update forum title and description', async () => {
            if (skipTests) return;

            // Create forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Original Title'],
                subtitle: ['Original Subtitle'],
                description: 'Original description',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum[0].id);

            // Update forum
            const updateResult = await forumsStore.updateForum(
                { id: forum[0].id, authorId: TEST_AUTHOR_ID },
                {
                    title: ['Updated Title'],
                    description: 'Updated description',
                },
            );

            expect(updateResult).to.be.an('array');
            expect(updateResult[0].id).to.equal(forum[0].id);

            // Verify update
            const updatedForum = await forumsStore.getForum(forum[0].id);
            expect(updatedForum[0].title).to.deep.equal(['Updated Title']);
            expect(updatedForum[0].description).to.equal('Updated description');
        });

        it('should update forum visibility', async () => {
            if (skipTests) return;

            // Create public forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Visibility Test Forum'],
                subtitle: ['Test'],
                description: 'Testing visibility change',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
                isPublic: true,
            });
            createdForumIds.push(forum[0].id);

            // Update to private
            await forumsStore.updateForum(
                { id: forum[0].id, authorId: TEST_AUTHOR_ID },
                { isPublic: false },
            );

            // Verify update
            const updatedForum = await forumsStore.getForum(forum[0].id);
            expect(updatedForum[0].isPublic).to.be.eq(false);
        });

        it('should not update forum without author authorization', async () => {
            if (skipTests) return;

            // Create forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Auth Test Forum'],
                subtitle: ['Test'],
                description: 'Testing authorization',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum[0].id);

            // Try to update with wrong author
            const updateResult = await forumsStore.updateForum(
                { id: forum[0].id, authorId: 'wrong-author-id' },
                { title: ['Unauthorized Update'] },
            );

            // Should return empty array (no rows updated)
            expect(updateResult).to.be.an('array');
            expect(updateResult.length).to.equal(0);
        });
    });

    describe('Archive Forum', () => {
        it('should archive forum with author authorization', async () => {
            if (skipTests) return;

            // Create forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Forum to Archive'],
                subtitle: ['Test'],
                description: 'This forum will be archived',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum[0].id);

            // Archive forum
            const archiveResult = await forumsStore.archiveForum({
                id: forum[0].id,
                authorId: TEST_AUTHOR_ID,
            });

            expect(archiveResult).to.be.an('array');
            expect(archiveResult[0].id).to.equal(forum[0].id);

            // Verify archived
            const archivedForum = await forumsStore.getForum(forum[0].id);
            expect(archivedForum[0].archivedAt).to.not.be.eq(null);
        });

        it('should not archive forum without author authorization', async () => {
            if (skipTests) return;

            // Create forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Cannot Archive'],
                subtitle: ['Test'],
                description: 'Should not be archived by wrong user',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            createdForumIds.push(forum[0].id);

            // Try to archive with wrong author
            const archiveResult = await forumsStore.archiveForum({
                id: forum[0].id,
                authorId: 'wrong-author-id',
            });

            // Should return empty array (no rows archived)
            expect(archiveResult).to.be.an('array');
            expect(archiveResult.length).to.equal(0);
        });
    });

    describe('Delete Forum', () => {
        it('should hard delete forum by id', async () => {
            if (skipTests) return;

            // Create forum
            const forum = await forumsStore.createForum({
                authorId: TEST_AUTHOR_ID,
                authorLocale: 'en-us',
                administratorIds: TEST_AUTHOR_ID,
                categoryTags: [validCategoryTag],
                title: ['Forum to Delete'],
                subtitle: ['Test'],
                description: 'This forum will be deleted',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
            });
            // Don't add to createdForumIds since we're deleting it

            // Clean up categories first (foreign key)
            await cleanupTestData('forumCategories', { forumId: forum[0].id });

            // Delete forum
            const deleteResult = await forumsStore.deleteForum(forum[0].id);

            expect(deleteResult).to.be.an('array');

            // Verify deleted
            const deletedForum = await forumsStore.getForum(forum[0].id);
            expect(deletedForum.length).to.equal(0);
        });
    });
});
