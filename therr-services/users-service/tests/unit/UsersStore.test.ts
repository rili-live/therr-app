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

    describe('searchUsers', () => {
        // Regression: the People/discovery list must not be gated on phone verification alone.
        // Phone verification is deferred under frictionless onboarding, so onlyVerified must
        // match EMAIL_VERIFIED or MOBILE_VERIFIED, otherwise nearly every user is filtered out.
        it('gates onlyVerified on email OR phone verification', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUsers('req-user-1', {
                limit: 50,
                offset: 0,
            }, false, true);

            const generatedSql = mockStore.read.query.args[0][0];
            // `?|` is an any-of match, so the order of the array literal is not significant —
            // assert on membership rather than the exact rendering.
            expect(generatedSql).to.contain('"accessLevels" ?| ARRAY[');
            expect(generatedSql).to.contain(`'user.verified.email'`);
            expect(generatedSql).to.contain(`'user.verified.mobile'`);
            // Must NOT fall back to the mobile-only single-key form that emptied the list.
            expect(generatedSql).to.not.contain(`"accessLevels" ? 'user.verified.mobile'`);
        });

        // Regression: discovery must be brand-scoped. main.users is identity-shared (no brand
        // column); enrollment lives in the brandVariations JSONB array. Without this filter,
        // every niche app leaked the full cross-brand user list (e.g. Habits showed Therr users).
        it('scopes results to the requesting brand when brandVariation is provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUsers('req-user-1', {
                limit: 50,
                offset: 0,
                brandVariation: 'habits',
            }, false, true);

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.contain(`"brandVariations" @> '[{"brand":"habits"}]'::jsonb`);
        });

        it('omits the brand filter when brandVariation is not provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUsers('req-user-1', {
                limit: 50,
                offset: 0,
            }, false, true);

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.not.contain('brandVariations');
        });

        it('omits the verification filter when onlyVerified is false', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUsers('req-user-1', {
                limit: 50,
                offset: 0,
            }, false, false);

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.not.contain('accessLevels');
        });
    });

    // Regression: People-You-May-Know reads through findUsers. It must be brand-scopable,
    // otherwise the mightKnow list leaks cross-brand accounts (contact-matched Therr users
    // surfacing inside Habits) even though searchUsers results are already scoped.
    describe('findUsers', () => {
        it('scopes to the requesting brand when brandVariation is provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUsers({
                ids: ['user-1', 'user-2'],
                brandVariation: 'habits',
            });

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.contain(`"brandVariations" @> '[{"brand":"habits"}]'::jsonb`);
        });

        it('omits the brand filter when brandVariation is not provided (brand-agnostic lookups)', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUsers({ ids: ['user-1', 'user-2'] });

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.not.contain('brandVariations');
        });
    });

    describe('findUsersByContactInfo', () => {
        it('scopes contact matches to the requesting brand when provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUsersByContactInfo(
                [{ email: 'test@email.com' }, { phoneNumber: '+13176665849' }],
                ['id'],
                'habits',
            );

            const generatedSql = mockStore.read.query.args[0][0];
            // The email/phone OR must be grouped so the brand filter ANDs against the whole set.
            expect(generatedSql).to.contain(`"brandVariations" @> '[{"brand":"habits"}]'::jsonb`);
            expect(generatedSql).to.match(/where \(.*"email" in.*or "phoneNumber" in.*\) and/i);
        });

        it('omits the brand filter when brandVariation is not provided (e.g. invites)', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.findUsersByContactInfo([{ email: 'test@email.com' }], ['id']);

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.not.contain('brandVariations');
        });
    });

    describe('searchUserSocials', () => {
        // Regression: influencer-pairing discovery leaked cross-brand accounts. Its sibling
        // searchUsers was brand-scoped during the Phase 5 isolation work but this one was
        // missed, so a niche dashboard paired its users against every brand's accounts.
        it('scopes results to the requesting brand when brandVariation is provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUserSocials('req-user-1', {
                limit: 50,
                offset: 0,
                brandVariation: 'habits',
            });

            const generatedSql = mockStore.read.query.args[0][0];
            // Must be table-qualified: this query joins socialSyncs, so a bare
            // "brandVariations" would be ambiguous if that table ever grows the column.
            expect(generatedSql).to.contain(`"main"."users"."brandVariations" @> '[{"brand":"habits"}]'::jsonb`);
        });

        it('omits the brand filter when brandVariation is not provided', () => {
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const store = new UsersStore(mockStore);
            store.searchUserSocials('req-user-1', {
                limit: 50,
                offset: 0,
            });

            const generatedSql = mockStore.read.query.args[0][0];
            expect(generatedSql).to.not.contain('brandVariations');
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

        // Guards against a host-timezone-dependent shift: knex renders a raw JS Date into the
        // Node process's local timezone with no offset, which Postgres then reads as UTC.
        // Asserting on the emitted SQL keeps this test meaningful regardless of the host's TZ.
        it('writes lastLoginAt as a UTC ISO-8601 literal', () => {
            const expected = `"lastLoginAt" = '2026-07-09T18:00:00.000Z'`;
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UsersStore(mockStore);
            store.updateUser({
                lastLoginAt: new Date('2026-07-09T18:00:00.000Z'),
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
