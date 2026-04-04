/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import SpacePairingFeedbackStore from '../../src/store/SpacePairingFeedbackStore';

describe('SpacePairingFeedbackStore', () => {
    describe('create', () => {
        it('inserts without upsert for anonymous users (no userId)', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new SpacePairingFeedbackStore(mockStore);
            store.create({
                sourceSpaceId: 'aaa-111',
                pairedSpaceId: 'bbb-222',
                isHelpful: true,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into');
            expect(query).to.include('"spacePairingFeedback"');
            expect(query).to.not.include('ON CONFLICT');
        });

        it('uses upsert for authenticated users (with userId)', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new SpacePairingFeedbackStore(mockStore);
            store.create({
                sourceSpaceId: 'aaa-111',
                pairedSpaceId: 'bbb-222',
                userId: 'user-123',
                isHelpful: false,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('INSERT INTO');
            expect(query).to.include('ON CONFLICT');
            expect(query).to.include('DO UPDATE SET');
            expect(query).to.include('RETURNING *');
        });

        it('passes correct params in upsert query', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new SpacePairingFeedbackStore(mockStore);
            store.create({
                sourceSpaceId: 'source-id',
                pairedSpaceId: 'paired-id',
                userId: 'user-id',
                isHelpful: true,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include("'source-id'");
            expect(query).to.include("'paired-id'");
            expect(query).to.include("'user-id'");
        });
    });

    describe('getAggregateBySourceId', () => {
        it('queries with correct groupBy and filters', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new SpacePairingFeedbackStore(mockStore);
            store.getAggregateBySourceId('source-123');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"spacePairingFeedback"');
            expect(query).to.include(`"sourceSpaceId" = 'source-123'`);
            expect(query).to.include('group by');
            expect(query).to.include('"pairedSpaceId"');
            expect(query).to.include('"helpfulCount"');
            expect(query).to.include('"notHelpfulCount"');
        });
    });
});
