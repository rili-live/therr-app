/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { awsSES } from '../../src/api/aws';
import {
    createUserHelper,
    isUserProfileIncomplete,
} from '../../src/handlers/helpers/user';
import Store from '../../src/store';
import UsersStore from '../../src/store/UsersStore';
import VerificationCodesStore from '../../src/store/VerificationCodesStore';

afterEach(() => {
    sinon.restore();
});

describe('handlers/helpers/user', () => {
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

        it('is true if user already exists and update is missing properties to complete profile', () => {
            const mockUpdate = {
                userName: 'bar',
            };
            const mockExistingUser = {
                phoneNumber: 'foo',
                lastName: 'bar',
            };

            expect(isUserProfileIncomplete(mockUpdate, mockExistingUser)).to.be.equal(true);
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
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const awsStub = sinon.stub(awsSES, 'sendEmail').yields(null, {});

            createUserHelper(mockHeaders, mockUserDetails, false, undefined, true).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsEmailBusMarketing", "settingsEmailMarketing", "userName", "verificationCodes") values ('["user.default"]', '{"brand":"therr","details":{}}', 'testuser@gmail.com', 'bob', true, DEFAULT, false, 'smith'`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', '+13175448348', DEFAULT, DEFAULT, 'testuser', '{"email":{"code":"`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`"}}') returning *`))
                    .to.be.equal(true);
                expect(result.id).to.be.equal('mock-id');
                vCodesStub.restore();
                usersStoreStub.restore();
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
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
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const awsStub = sinon.stub(awsSES, 'sendEmail').yields(null, {});

            createUserHelper(mockHeaders, mockUserDetails, true).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                // Create User
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsEmailBusMarketing", "settingsEmailMarketing", "userName", "verificationCodes") values ('["user.default","user.verified.email.missing.props"]', '{"brand":"therr","details":{}}', 'testuser@gmail.com', DEFAULT, true, DEFAULT, DEFAULT, DEFAULT, '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', DEFAULT, DEFAULT, DEFAULT, DEFAULT, '{"email":{"code":"`))
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
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
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
            const vCodesStub = sinon.stub(Store, 'verificationCodes')
                .value(new VerificationCodesStore(mockVerificationCodesStoreConnection));
            const usersStoreStub = sinon.stub(Store, 'users')
                .value(new UsersStore(mockUserStoreConnection));
            const awsStub = sinon.stub(awsSES, 'sendEmail').yields(null, {});

            createUserHelper(mockHeaders, mockUserDetails, false, mockUserByInviteDetails).then((result) => {
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`insert into "main"."verificationCodes" ("code", "type") values (`))
                    .to.be.equal(true);
                expect(mockVerificationCodesStoreConnection.write.query.args[0][0].includes(`', 'email')`))
                    .to.be.equal(true);
                // Create User
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`insert into "main"."users" ("accessLevels", "brandVariations", "email", "firstName", "hasAgreedToTerms", "isBusinessAccount", "isCreatorAccount", "lastName", "password", "phoneNumber", "settingsEmailBusMarketing", "settingsEmailMarketing", "userName", "verificationCodes") values ('["user.default"]', '{"brand":"therr","details":{}}', 'test2user@gmail.com', DEFAULT, false, DEFAULT, DEFAULT, DEFAULT, '`))
                    .to.be.equal(true);
                expect(mockUserStoreConnection.write.query.args[0][0].includes(`', DEFAULT, DEFAULT, DEFAULT, DEFAULT, '{"email":{"code":"`))
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
                awsStub.restore();
                done();
            }).catch((err) => {
                console.log(err);
            });
        });
    });
});
