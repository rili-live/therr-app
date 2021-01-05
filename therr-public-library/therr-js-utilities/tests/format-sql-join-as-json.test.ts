/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import formatSqlJoinAsJson from '../src/format-sql-join-as-json';

describe('formatSqlJoinAsJson', () => {
    it('correctly formats a complex JOIN', () => {
        const expected = [
            {
                id: 8,
                requestingUserId: 7,
                acceptingUserId: 8,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:37.595Z',
                updatedAt: '2020-12-30T17:31:20.423Z',
                users: [
                    {
                        id: 7,
                        userName: 'zanselm5',
                        firstName: 'Zack',
                        lastName: 'Anselm',
                    },
                    {
                        id: 8,
                        userName: 'rili',
                        firstName: 'Rili',
                        lastName: 'Main',
                    },
                ],
            },
            {
                id: 9,
                requestingUserId: 7,
                acceptingUserId: 9,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:42.820Z',
                updatedAt: '2020-12-30T17:32:20.343Z',
                users: [
                    {
                        id: 7,
                        userName: 'zanselm5',
                        firstName: 'Zack',
                        lastName: 'Anselm',
                    },
                    {
                        id: 9,
                        userName: 'therr',
                        firstName: 'Therr',
                        lastName: 'Main',
                    },
                ],
            },
        ];
        const mockDataArray = [
            {
                id: 8,
                requestingUserId: 7,
                acceptingUserId: 8,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:37.595Z',
                updatedAt: '2020-12-30T17:31:20.423Z',
                'users[].id': 7,
                'users[].userName': 'zanselm5',
                'users[].firstName': 'Zack',
                'users[].lastName': 'Anselm',
            },
            {
                id: 8,
                requestingUserId: 7,
                acceptingUserId: 8,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:37.595Z',
                updatedAt: '2020-12-30T17:31:20.423Z',
                'users[].id': 8,
                'users[].userName': 'rili',
                'users[].firstName': 'Rili',
                'users[].lastName': 'Main',
            },
            {
                id: 9,
                requestingUserId: 7,
                acceptingUserId: 9,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:42.820Z',
                updatedAt: '2020-12-30T17:32:20.343Z',
                'users[].id': 7,
                'users[].userName': 'zanselm5',
                'users[].firstName': 'Zack',
                'users[].lastName': 'Anselm',
            },
            {
                id: 9,
                requestingUserId: 7,
                acceptingUserId: 9,
                interactionCount: 1,
                requestStatus: 'complete',
                isConnectionBroken: false,
                createdAt: '2020-12-30T17:30:42.820Z',
                updatedAt: '2020-12-30T17:32:20.343Z',
                'users[].id': 9,
                'users[].userName': 'therr',
                'users[].firstName': 'Therr',
                'users[].lastName': 'Main',
            },
        ];
        const mockArrayPropKeys = ['users'];

        const formatted = formatSqlJoinAsJson(mockDataArray, mockArrayPropKeys);

        expect(formatted).to.be.deep.equal(expected);
    });
});
