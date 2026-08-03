/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import { awsSES } from '../../src/api/aws';
import {
    createUserHelper,
    getUserHelper,
    isUserProfileIncomplete,
} from '../../src/handlers/helpers/user';
import Store from '../../src/store';
import UsersStore from '../../src/store/UsersStore';
import UserAchievementsStore from '../../src/store/UserAchievementsStore';
import VerificationCodesStore from '../../src/store/VerificationCodesStore';

afterEach(() => {
    sinon.restore();
});

describe('handlers/helpers/user', () => {
    describe('getUserHelper connection status', () => {
        const TARGET_USER_ID = 'target-user-id';
        const VIEWER_USER_ID = 'viewer-user-id';

        // Captures whatever getUserHelper hands to res.send
        const mockResponse = () => {
            const res: any = {};
            res.status = sinon.stub().returns(res);
            res.send = sinon.stub().returns(res);
            return res;
        };

        const stubStoresFor = (connectionRow: any, settingsIsProfilePublic = true) => {
            sinon.stub(Store.users, 'getUserByConditions').resolves([{
                id: TARGET_USER_ID,
                userName: 'targetuser',
                firstName: 'Target',
                lastName: 'User',
                settingsIsProfilePublic,
            }]);
            sinon.stub(Store.userConnections, 'countUserConnections').resolves([{ count: '3' }]);
            sinon.stub(Store.socialSyncs, 'getSyncs').resolves([]);
            sinon.stub(Store.userConnections, 'getUserConnections').resolves(connectionRow ? [connectionRow] : []);
        };

        const getProfileFor = async (connectionRow: any, settingsIsProfilePublic = true) => {
            stubStoresFor(connectionRow, settingsIsProfilePublic);
            const res = mockResponse();

            await getUserHelper({
                isAuthorized: true,
                requestingUserId: VIEWER_USER_ID,
                targetUserParams: { id: TARGET_USER_ID },
                res,
            });

            return res.send.firstCall.args[0];
        };

        it('reports a completed, unbroken connection as connected', async () => {
            const profile = await getProfileFor({
                requestingUserId: VIEWER_USER_ID,
                acceptingUserId: TARGET_USER_ID,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            });

            expect(profile.isNotConnected).to.equal(false);
            expect(profile.isPendingConnection).to.equal(false);
        });

        it('reports a completed connection stored in the reverse direction as connected', async () => {
            // getUserConnections is called with shouldCheckReverse, so the row it returns is
            // just as likely to name the viewer as the accepting side.
            const profile = await getProfileFor({
                requestingUserId: TARGET_USER_ID,
                acceptingUserId: VIEWER_USER_ID,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            });

            expect(profile.isNotConnected).to.equal(false);
        });

        it('reports a broken connection as not connected, matching the connections list', async () => {
            // searchUserConnections filters on isConnectionBroken = false, so a broken row is
            // absent from the connections list. The profile has to agree.
            const profile = await getProfileFor({
                requestingUserId: VIEWER_USER_ID,
                acceptingUserId: TARGET_USER_ID,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: true,
            });

            expect(profile.isNotConnected).to.equal(true);
        });

        it('reports a pending request as not connected but pending', async () => {
            const profile = await getProfileFor({
                requestingUserId: VIEWER_USER_ID,
                acceptingUserId: TARGET_USER_ID,
                requestStatus: UserConnectionTypes.PENDING,
                isConnectionBroken: false,
            });

            expect(profile.isNotConnected).to.equal(true);
            expect(profile.isPendingConnection).to.equal(true);
        });

        it('reports a might-know edge as not connected', async () => {
            const profile = await getProfileFor({
                requestingUserId: VIEWER_USER_ID,
                acceptingUserId: TARGET_USER_ID,
                requestStatus: UserConnectionTypes.MIGHT_KNOW,
                isConnectionBroken: false,
            });

            expect(profile.isNotConnected).to.equal(true);
            expect(profile.isPendingConnection).to.equal(false);
        });

        it('reports no connection row at all as not connected', async () => {
            const profile = await getProfileFor(null);

            expect(profile.isNotConnected).to.equal(true);
            expect(profile.isPendingConnection).to.equal(false);
        });

        it('keeps a private profile visible to a completed connection', async () => {
            const profile = await getProfileFor({
                requestingUserId: VIEWER_USER_ID,
                acceptingUserId: TARGET_USER_ID,
                requestStatus: UserConnectionTypes.COMPLETE,
                isConnectionBroken: false,
            }, false);

            expect(profile.isNotConnected).to.equal(false);
            expect(profile.firstName).to.equal('Target');
        });

        it('does not offer a connect action on your own profile', async () => {
            sinon.stub(Store.users, 'getUserByConditions').resolves([{
                id: VIEWER_USER_ID,
                userName: 'viewer',
                settingsIsProfilePublic: false,
            }]);
            sinon.stub(Store.userConnections, 'countUserConnections').resolves([{ count: '0' }]);
            sinon.stub(Store.socialSyncs, 'getSyncs').resolves([]);
            const res = mockResponse();

            await getUserHelper({
                isAuthorized: true,
                requestingUserId: VIEWER_USER_ID,
                targetUserParams: { id: VIEWER_USER_ID },
                res,
            });

            expect(res.send.firstCall.args[0].isNotConnected).to.equal(false);
        });
    });

    describe('isUserProfileIncomplete', () => {
        it('is true if no existing user and update is missing properties', () => {
            const mockUpdate = {};

            expect(isUserProfileIncomplete(mockUpdate)).to.be.equal(true);
        });

        it('is false if no existing user and update has at all required properties', () => {
            const mockUpdate = {
                phoneNumber: 'foo',
                userName: 'bar',
                firstName: 'foo',
                lastName: 'bar',
            };

            expect(isUserProfileIncomplete(mockUpdate)).to.be.equal(false);
        });

        it('is true if user already exists and neither the update nor the record supplies a userName', () => {
            // As of the 2026-07 deferred-phone-verification change, userName is the
            // sole completeness requirement: phone is prompted contextually and
            // enforced on phone-sensitive actions via MOBILE_VERIFIED at the gateway.
            const mockUpdate = {
                phoneNumber: 'foo',
            };
            const mockExistingUser = {
                lastName: 'bar',
            };

            expect(isUserProfileIncomplete(mockUpdate, mockExistingUser)).to.be.equal(true);
        });

        it('is false if user already exists and the update supplies the missing userName', () => {
            const mockUpdate = {
                userName: 'bar',
            };
            const mockExistingUser = {
                lastName: 'bar',
            };

            expect(isUserProfileIncomplete(mockUpdate, mockExistingUser)).to.be.equal(false);
        });

        it('is false if user already exists and update has all missing, required properties', () => {
            const mockUpdate = {
                phoneNumber: 'foobar',
                userName: 'bar',
            };
            const mockExistingUser = {
                phoneNumber: 'foo',
                firstName: 'foo',
                lastName: 'bar',
            };

            expect(isUserProfileIncomplete(mockUpdate, mockExistingUser)).to.be.equal(false);
        });
    });

    // TODO: Add tests for sendEmail args
    describe('createUserHelper', () => {
        it('handle basic auth', (done) => {
            const mockUserDetails = {
                email: 'test.user@gmail.com', // this email should get normalized
                password: 'strinG123!',
                firstName: 'bob',
                isUnclaimed: false,
                lastName: 'smith',
                phoneNumber: '+13175448348',
                userName: 'testUser', // this should be made lowercase
                isCreatorAccount: false,
            };
            const mockHeaders = {
                'x-platform': 'mobile',
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
                'x-username': 'testUser',
            };
            const mockUserStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                            isUnclaimed: false,
                        }],
                    })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                        }],
                    })),
                },
            };
            const mockVerificationCodesStoreConnection = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const mockUserAchievementsStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const userAchievementsStub = sinon.stub(Store, 'userAchievements')
                .value(new UserAchievementsStore(mockUserAchievementsStoreConnection as any));
            const awsStub = sinon.stub(awsSES, 'sendEmail').resolves({});

            createUserHelper(mockHeaders, mockUserDetails, { hasInviteCode: true }).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsBirthdate", "settingsEmailBusMarketing", "settingsEmailMarketing", "settingsLocale", "userName", "verificationCodes") values ('["user.default"]', '[{"brand":"therr","firstSeenAt":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`","isActive":true}]', 'testuser@gmail.com', 'bob', true, DEFAULT, false, 'smith'`))
                    .to.be.equal(true);
                // The fixture submits compact E.164 ('+13175448348') and this used to assert it
                // was stored verbatim. `UsersStore.createUser` now normalizes on write so new
                // rows share one dialect with the phone-verification flow — storing the raw
                // submission is what left `main.users.phoneNumber` mixed and made passwordless
                // sign-in silently resolve zero accounts.
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', '+1 317-544-8348', DEFAULT, DEFAULT, DEFAULT, DEFAULT, 'testuser', '{"email":{"code":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`"}}') returning *`))
                    .to.be.equal(true);
                expect(result.id).to.be.equal('mock-id');
                vCodesStub.restore();
                usersStoreStub.restore();
                userAchievementsStub.restore();
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
                done(err);
            });
        });

        it('handle SSO (single sign-on)', (done) => {
            const mockUserDetails = {
                email: 'test.user@gmail.com', // this email should get normalized
            };
            const mockHeaders = {
                'x-platform': 'mobile',
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
                'x-username': 'testUser',
            };
            const mockUserStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                            isUnclaimed: false,
                        }],
                    })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                        }],
                    })),
                },
            };
            const mockVerificationCodesStoreConnection = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const mockUserAchievementsStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const userAchievementsStub = sinon.stub(Store, 'userAchievements')
                .value(new UserAchievementsStore(mockUserAchievementsStoreConnection as any));
            const awsStub = sinon.stub(awsSES, 'sendEmail').resolves({});

            createUserHelper(mockHeaders, mockUserDetails, { isSSO: true }).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                // Create User
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsBirthdate", "settingsEmailBusMarketing", "settingsEmailMarketing", "settingsLocale", "userName", "verificationCodes") values ('["user.default","user.verified.email.missing.props"]', '[{"brand":"therr","firstSeenAt":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`","isActive":true}]', 'testuser@gmail.com', DEFAULT, true, DEFAULT, DEFAULT, DEFAULT, '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, '{"email":{"code":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`"}}') returning *`))
                    .to.be.equal(true);
                // Update User
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`update "main"."users" set "oneTimePassword" = '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`', "updatedAt" = '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`' where "email" = 'testuser@gmail.com' returning *`))
                    .to.be.equal(true);
                expect(result.id).to.be.equal('mock-id');
                vCodesStub.restore();
                usersStoreStub.restore();
                userAchievementsStub.restore();
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
                done(err);
            });
        });

        it('handle user by invite', (done) => {
            const mockUserDetails = {
                email: 'test2.user@gmail.com', // this email should get normalized
            };
            const mockUserByInviteDetails = {
                fromName: 'Bob Jones',
                fromEmail: 'test2.user@gmail.com', // this email should get normalized
                toEmail: 'bob.jones@gmail.com', // this email should get normalized
            };
            const mockHeaders = {
                'x-platform': 'mobile',
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
                'x-username': 'testUser',
            };
            const mockUserStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                            isUnclaimed: false,
                        }],
                    })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({
                        rows: [{
                            id: 'mock-id',
                        }],
                    })),
                },
            };
            const mockVerificationCodesStoreConnection = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const mockUserAchievementsStoreConnection = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const userAchievementsStub = sinon.stub(Store, 'userAchievements')
                .value(new UserAchievementsStore(mockUserAchievementsStoreConnection as any));
            const awsStub = sinon.stub(awsSES, 'sendEmail').resolves({});

            createUserHelper(mockHeaders, mockUserDetails, { userByInviteDetails: mockUserByInviteDetails }).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                // Create User
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsBirthdate", "settingsEmailBusMarketing", "settingsEmailMarketing", "settingsLocale", "userName", "verificationCodes") values ('["user.default"]', '[{"brand":"therr","firstSeenAt":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`","isActive":true}]', 'test2user@gmail.com', DEFAULT, false, DEFAULT, DEFAULT, DEFAULT, '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, '{"email":{"code":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`"}}') returning *`))
                    .to.be.equal(true);
                // Update User
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`update "main"."users" set "oneTimePassword" = '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`', "updatedAt" = '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[1][0].includes(`' where "email" = 'test2user@gmail.com' returning *`))
                    .to.be.equal(true);
                expect(result.id).to.be.equal('mock-id');
                vCodesStub.restore();
                usersStoreStub.restore();
                userAchievementsStub.restore();
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
                done(err);
            });
        });
    });
});
