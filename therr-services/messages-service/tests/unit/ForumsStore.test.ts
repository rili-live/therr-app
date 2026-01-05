/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import ForumsStore, { FORUMS_TABLE_NAME, ICreateForumParams } from '../../src/store/ForumsStore';

describe('ForumsStore', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('countRecords', () => {
        it('queries for total records with filter', () => {
            const expected = `select count(*) from "main"."forums" where "isPublic" = true`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ count: '5' }] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.countRecords({
                filterBy: 'isPublic',
                query: true,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('getForum', () => {
        it('queries for a forum by id', () => {
            const forumId = 'forum-123';
            const expected = `select * from "main"."forums" where "id" = '${forumId}'`;
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.getForum(forumId);

            expect(mockStore.write.query.args[0][0]).to.be.equal(expected);
        });

        it('returns forum data when found', async () => {
            const mockForum = {
                id: 'forum-123',
                title: 'Test Forum',
                authorId: 'user-1',
            };
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [mockForum] })),
                },
            };
            const store = new ForumsStore(mockStore);
            const result = await store.getForum('forum-123');

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0].id).to.equal('forum-123');
        });
    });

    describe('getForums', () => {
        it('queries with conditions and filters archived forums by default', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.getForums({ authorId: 'user-1' }, null);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('select * from "main"."forums"');
            expect(queryString).to.include('"archivedAt" is null');
            expect(queryString).to.include(`"authorId" = 'user-1'`);
        });

        it('includes archived forums when flag is false', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.getForums({ authorId: 'user-1' }, null, false);

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.not.include('"archivedAt" is null');
        });

        it('applies OR conditions when provided', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.getForums({ authorId: 'user-1', title: 'Test' }, { authorId: 'user-1', subtitle: 'Subtitle' });

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('"authorId"');
            expect(queryString).to.include('"title"');
            expect(queryString).to.include('"subtitle"');
        });
    });

    describe('findForums', () => {
        it('queries for forums by multiple ids', () => {
            const ids = ['forum-1', 'forum-2', 'forum-3'];
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            store.findForums(ids);

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('select "id", "title" from "main"."forums"');
            expect(queryString).to.include(`"id" in ('forum-1', 'forum-2', 'forum-3')`);
        });

        it('returns id and title for each forum', async () => {
            const mockForums = [
                { id: 'forum-1', title: 'Forum One' },
                { id: 'forum-2', title: 'Forum Two' },
            ];
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: mockForums })),
                },
            };
            const store = new ForumsStore(mockStore);
            const result = await store.findForums(['forum-1', 'forum-2']);

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            expect(result[0]).to.have.property('id');
            expect(result[0]).to.have.property('title');
        });
    });

    describe('searchForums', () => {
        it('queries with pagination', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            await store.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 2 },
                    order: 'desc',
                },
                [],
                {},
            );

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('limit 10');
            expect(queryString).to.include('offset 10'); // (page 2 - 1) * 10
        });

        it('filters by public forums when no usersInvitedForumIds', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            await store.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                {},
            );

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('"isPublic" = true');
            expect(queryString).to.include('"archivedAt" is null');
        });

        it('filters by forum IDs when provided', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            await store.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                { forumIds: [1, 2, 3] },
            );

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include('"id" in (1, 2, 3)');
        });

        it('applies filter conditions with ilike operator', async () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new ForumsStore(mockStore);
            await store.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                    filterBy: 'title',
                    filterOperator: 'ilike',
                    query: 'test',
                },
                [],
                {},
            );

            const queryString = mockStore.read.query.args[0][0];
            expect(queryString).to.include(`"title" ilike '%test%'`);
        });
    });

    describe('createForum', () => {
        it('inserts forum and creates category associations', async () => {
            const mockForum = {
                id: 'forum-123',
                title: 'Test Forum',
                authorId: 'user-1',
            };
            const mockStore = {
                write: {
                    query: sinon.stub()
                        .onFirstCall().resolves({ rows: [mockForum] })
                        .onSecondCall()
                        .resolves({ rows: [] }),
                },
            };
            const store = new ForumsStore(mockStore);

            const params: ICreateForumParams = {
                authorId: 'user-1',
                authorLocale: 'en-us',
                administratorIds: 'user-1',
                categoryTags: ['tech', 'general'],
                title: ['Test Forum'],
                subtitle: ['Subtitle'],
                description: 'Description',
                iconGroup: 'group1',
                iconId: 'icon1',
                iconColor: '#000000',
            };

            const result = await store.createForum(params);

            expect(mockStore.write.query.calledTwice).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('forum-123');

            // Verify first call is forum insert
            const firstQuery = mockStore.write.query.args[0][0];
            expect(firstQuery).to.include('insert into "main"."forums"');
            expect(firstQuery).to.include('"authorId"');

            // Verify second call is category insert
            const secondQuery = mockStore.write.query.args[1][0];
            expect(secondQuery).to.include('insert into "main"."forumCategories"');
        });
    });

    describe('updateForum', () => {
        it('updates forum with conditions and sets updatedAt', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'forum-123' }] })),
                },
            };
            const store = new ForumsStore(mockStore);

            await store.updateForum(
                { id: 'forum-123', authorId: 'user-1' },
                { title: ['Updated Title'] },
            );

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('update "main"."forums"');
            expect(queryString).to.include('"updatedAt"');
            expect(queryString).to.include(`"id" = 'forum-123'`);
            expect(queryString).to.include(`"authorId" = 'user-1'`);
        });

        it('returns updated forum id', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'forum-123' }] })),
                },
            };
            const store = new ForumsStore(mockStore);

            const result = await store.updateForum(
                { id: 'forum-123' },
                { description: 'New description' },
            );

            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('forum-123');
        });
    });

    describe('archiveForum', () => {
        it('sets archivedAt timestamp with author authorization', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'forum-123' }] })),
                },
            };
            const store = new ForumsStore(mockStore);

            await store.archiveForum({ id: 'forum-123', authorId: 'user-1' });

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('update "main"."forums"');
            expect(queryString).to.include('"archivedAt"');
            expect(queryString).to.include(`"id" = 'forum-123'`);
            expect(queryString).to.include(`"authorId" = 'user-1'`);
        });

        it('returns archived forum id', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'forum-123' }] })),
                },
            };
            const store = new ForumsStore(mockStore);

            const result = await store.archiveForum({ id: 'forum-123', authorId: 'user-1' });

            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('forum-123');
        });
    });

    describe('deleteForum', () => {
        it('hard deletes forum by id', async () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{ id: 'forum-123' }] })),
                },
            };
            const store = new ForumsStore(mockStore);

            await store.deleteForum('forum-123');

            const queryString = mockStore.write.query.args[0][0];
            expect(queryString).to.include('delete from "main"."forums"');
            expect(queryString).to.include(`"id" = 'forum-123'`);
        });
    });
});
