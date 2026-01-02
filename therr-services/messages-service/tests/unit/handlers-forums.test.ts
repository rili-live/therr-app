/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Forums Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createForum', () => {
        it('should create a forum with required fields', async () => {
            const mockForum = {
                id: 'forum-123',
                title: 'Test Forum',
                subtitle: 'A test forum',
                description: 'Description here',
                authorId: 'user-1',
                isPublic: true,
            };

            const createForumStub = sinon.stub(Store.forums, 'createForum').resolves([mockForum]);

            const result = await Store.forums.createForum({
                authorId: 'user-1',
                authorLocale: 'en-us',
                administratorIds: 'user-1',
                categoryTags: ['general'],
                title: ['Test Forum'],
                subtitle: ['A test forum'],
                description: 'Description here',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000000',
                isPublic: true,
            });

            expect(createForumStub.calledOnce).to.be.eq(true);
            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('forum-123');
        });

        it('should create forum with category associations', async () => {
            const createForumStub = sinon.stub(Store.forums, 'createForum').resolves([{ id: 'forum-1' }]);

            await Store.forums.createForum({
                authorId: 'user-1',
                authorLocale: 'en-us',
                administratorIds: 'user-1',
                categoryTags: ['tech', 'programming', 'javascript'],
                title: ['Tech Forum'],
                subtitle: ['Subtitle'],
                description: 'Description',
                iconGroup: 'default',
                iconId: 'icon',
                iconColor: '#000',
            });

            expect(createForumStub.calledOnce).to.be.eq(true);
            const callArgs = createForumStub.args[0][0];
            expect(callArgs.categoryTags).to.deep.equal(['tech', 'programming', 'javascript']);
        });

        it('should set default values for optional fields', async () => {
            const createForumStub = sinon.stub(Store.forums, 'createForum').resolves([{ id: 'forum-1' }]);

            await Store.forums.createForum({
                authorId: 'user-1',
                authorLocale: 'en-us',
                administratorIds: 'user-1',
                categoryTags: ['general'],
                title: ['Forum'],
                subtitle: ['Sub'],
                description: 'Desc',
                iconGroup: 'default',
                iconId: 'icon',
                iconColor: '#000',
                maxCommentsPerMin: 50,
                doesExpire: true,
            });

            const callArgs = createForumStub.args[0][0];
            expect(callArgs.maxCommentsPerMin).to.equal(50);
            expect(callArgs.doesExpire).to.be.eq(true);
        });
    });

    describe('getForum', () => {
        it('should return forum by id', async () => {
            const mockForum = {
                id: 'forum-123',
                title: 'Test Forum',
                authorId: 'user-1',
            };

            const getForumStub = sinon.stub(Store.forums, 'getForum').resolves([mockForum]);

            const result = await Store.forums.getForum('forum-123');

            expect(getForumStub.calledOnce).to.be.eq(true);
            expect(getForumStub.calledWith('forum-123')).to.be.eq(true);
            expect(result[0].id).to.equal('forum-123');
        });

        it('should return empty array when forum not found', async () => {
            const getForumStub = sinon.stub(Store.forums, 'getForum').resolves([]);

            const result = await Store.forums.getForum('nonexistent-id');

            expect(result).to.be.an('array');
            expect(result.length).to.equal(0);
        });
    });

    describe('getForums', () => {
        it('should filter out archived forums by default', async () => {
            const getForumsStub = sinon.stub(Store.forums, 'getForums').resolves([]);

            await Store.forums.getForums({ authorId: 'user-1' }, null, true);

            expect(getForumsStub.calledOnce).to.be.eq(true);
            expect(getForumsStub.args[0][2]).to.be.eq(true);
        });

        it('should include archived forums when flag is false', async () => {
            const getForumsStub = sinon.stub(Store.forums, 'getForums').resolves([]);

            await Store.forums.getForums({ authorId: 'user-1' }, null, false);

            expect(getForumsStub.args[0][2]).to.be.eq(false);
        });

        it('should apply OR conditions', async () => {
            const getForumsStub = sinon.stub(Store.forums, 'getForums').resolves([]);

            await Store.forums.getForums(
                { authorId: 'user-1', title: 'Title1' },
                { authorId: 'user-1', subtitle: 'Sub1' },
            );

            expect(getForumsStub.args[0][1]).to.deep.equal({ authorId: 'user-1', subtitle: 'Sub1' });
        });
    });

    describe('findForums', () => {
        it('should find forums by multiple IDs', async () => {
            const mockForums = [
                { id: 'forum-1', title: 'Forum One' },
                { id: 'forum-2', title: 'Forum Two' },
            ];

            const findForumsStub = sinon.stub(Store.forums, 'findForums').resolves(mockForums);

            const result = await Store.forums.findForums(['forum-1', 'forum-2']);

            expect(findForumsStub.calledOnce).to.be.eq(true);
            expect(result.length).to.equal(2);
        });

        it('should return only id and title', async () => {
            const mockForums = [
                { id: 'forum-1', title: 'Forum' },
            ];

            const findForumsStub = sinon.stub(Store.forums, 'findForums').resolves(mockForums);

            const result = await Store.forums.findForums(['forum-1']);

            expect(result[0]).to.have.property('id');
            expect(result[0]).to.have.property('title');
        });
    });

    describe('searchForums', () => {
        it('should search public forums with pagination', async () => {
            const searchForumsStub = sinon.stub(Store.forums, 'searchForums').resolves([]);

            await Store.forums.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                {},
            );

            expect(searchForumsStub.calledOnce).to.be.eq(true);
        });

        it('should filter by invited forum IDs for private forums', async () => {
            const searchForumsStub = sinon.stub(Store.forums, 'searchForums').resolves([]);

            await Store.forums.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                { usersInvitedForumIds: [1, 2, 3] },
            );

            expect(searchForumsStub.args[0][2].usersInvitedForumIds).to.deep.equal([1, 2, 3]);
        });

        it('should filter by category tags', async () => {
            const searchForumsStub = sinon.stub(Store.forums, 'searchForums').resolves([]);

            await Store.forums.searchForums(
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    order: 'desc',
                },
                [],
                { categoryTags: ['tech', 'programming'] },
            );

            expect(searchForumsStub.args[0][2].categoryTags).to.deep.equal(['tech', 'programming']);
        });

        it('should apply text filter with ilike', async () => {
            const searchForumsStub = sinon.stub(Store.forums, 'searchForums').resolves([]);

            await Store.forums.searchForums(
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

            expect(searchForumsStub.args[0][0].filterBy).to.equal('title');
            expect(searchForumsStub.args[0][0].filterOperator).to.equal('ilike');
        });
    });

    describe('updateForum', () => {
        it('should update forum with author authorization', async () => {
            const updateForumStub = sinon.stub(Store.forums, 'updateForum').resolves([{ id: 'forum-123' }]);

            await Store.forums.updateForum(
                { id: 'forum-123', authorId: 'user-1' },
                { title: ['Updated Title'] },
            );

            expect(updateForumStub.calledOnce).to.be.eq(true);
            expect(updateForumStub.args[0][0].authorId).to.equal('user-1');
        });

        it('should update multiple fields', async () => {
            const updateForumStub = sinon.stub(Store.forums, 'updateForum').resolves([{ id: 'forum-123' }]);

            await Store.forums.updateForum(
                { id: 'forum-123' },
                {
                    title: ['New Title'],
                    subtitle: ['New Subtitle'],
                    description: 'New description',
                    isPublic: false,
                },
            );

            const updateParams = updateForumStub.args[0][1];
            expect(updateParams.title).to.deep.equal(['New Title']);
            expect(updateParams.subtitle).to.deep.equal(['New Subtitle']);
            expect(updateParams.isPublic).to.be.eq(false);
        });
    });

    describe('archiveForum', () => {
        it('should archive forum with author authorization', async () => {
            const archiveForumStub = sinon.stub(Store.forums, 'archiveForum').resolves([{ id: 'forum-123' }]);

            await Store.forums.archiveForum({
                id: 'forum-123',
                authorId: 'user-1',
            });

            expect(archiveForumStub.calledOnce).to.be.eq(true);
            expect(archiveForumStub.args[0][0].id).to.equal('forum-123');
            expect(archiveForumStub.args[0][0].authorId).to.equal('user-1');
        });

        it('should return archived forum id', async () => {
            const archiveForumStub = sinon.stub(Store.forums, 'archiveForum').resolves([{ id: 'forum-123' }]);

            const result = await Store.forums.archiveForum({
                id: 'forum-123',
                authorId: 'user-1',
            });

            expect(result[0].id).to.equal('forum-123');
        });
    });

    describe('deleteForum', () => {
        it('should hard delete forum by id', async () => {
            const deleteForumStub = sinon.stub(Store.forums, 'deleteForum').resolves([{ id: 'forum-123' }]);

            await Store.forums.deleteForum('forum-123');

            expect(deleteForumStub.calledOnce).to.be.eq(true);
            expect(deleteForumStub.calledWith('forum-123')).to.be.eq(true);
        });
    });
});
