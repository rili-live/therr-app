/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import UsersStore from '../../src/store/UsersStore';

describe('UsersStore', () => {
    describe('getUsers', () => {
        it('selects with various OR conditions', () => {
            const expected = `select * from "main"."users" where "id" = 5 or ("userName" = 'test') or ("lastName" = 'test') order by "id" asc`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.getUsers({
                id: 5,
            }, {
                userName: 'test',
            }, {
                lastName: 'test',
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('findUser', () => {
        it('finds user with variable username', () => {
            const expected = `select * from "main"."users" where ("email" = 'test@email.com') or ("userName" = 'tests') or ("phoneNumber" = '+3176665849')`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUser({
                email: 'test@email.com',
                userName: 'tests',
                phoneNumber: '+3176665849',
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });

        it('normalizes email', () => {
            const expected = `select * from "main"."users" where ("email" = 'testabc@gmail.com')`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUser({
                email: 'test.a.b.c@gmail.com',
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    // Should not allow updating email (for security purposes)
    describe('updateUser', () => {
        it('only updates specific properties', () => {
            const expected = `update "main"."users" set "userName" = 'tests', "phoneNumber" = '+3176665849', "updatedAt" =`;
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.updateUser({
                email: 'test@email.com',
                userName: 'tests',
                createdAt: 'blah',
                phoneNumber: '+3176665849',
            }, {
                id: 5,
            });

            expect(mockStore.write.query.args[0][0].includes(expected)).to.be.equal(true);
        });

        it('requires email or id', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            const update = () => store.updateUser({
                email: 'test@email.com',
                userName: 'tests',
                createdAt: 'blah',
                phoneNumber: '+3176665849',
            }, {});

            expect(update).to.throw('User ID or email is required to call updateUser');
        });
    });

    // Should not allow updating email (for security purposes)
    describe('deleteUsers', () => {
        it('requires email or id', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            const delUser = () => store.deleteUsers({
                userName: 'tests',
                createdAt: 'blah',
                phoneNumber: '+3176665849',
            });

            expect(delUser).to.throw('User ID or email is required to call deleteUser');
        });
    });
});
