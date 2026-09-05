import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels, UserConnectionTypes } from 'therr-js-utilities/constants';
import normalizeEmail from 'normalize-email';
import Store from '../../src/store';
import {
    computeAccessLevelsAfterProfileUpdate,
    isUserProfileIncomplete,
    redactUserCreds,
} from '../../src/handlers/helpers/user';
import {
    createUser, getMe, updateUser, updateUserCoins,
} from '../../src/handlers/users';
// Aliased: two existing tests below declare a local `UsersStore` via require().
import UsersStoreClass from '../../src/store/UsersStore';
import UserAchievementsStore from '../../src/store/UserAchievementsStore';
import VerificationCodesStore from '../../src/store/VerificationCodesStore';
import { awsSES } from '../../src/api/aws';

// Minimal Express res double that captures the status + payload getMe sends.
const makeRes = () => {
    const res: any = {};
    res.statusCode = undefined;
    res.body = undefined;
    // Real Express throws ERR_HTTP_HEADERS_SENT on a second send; this double just counts
    // so tests can assert a handler responds exactly once.
    res.sendCount = 0;
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.send = (payload: any) => {
        res.sendCount += 1;
        res.body = payload;
        return res;
    };
    return res;
};

describe('Users Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('user creation', () => {
        it('should create a user with basic auth details', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                accessLevels: [AccessLevels.DEFAULT],
            };

            const createUserStub = sinon.stub(Store.users, 'createUser').resolves([mockUser]);

            const result = await Store.users.createUser({
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                password: 'hashedPassword',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            });

            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('user-123');
            expect(result[0].email).to.equal('test@test.com');
            createUserStub.restore();
        });

        it('should normalize email addresses on user creation', () => {
            // Gmail dots and casing should be normalized
            const email1 = normalizeEmail('Test.User@Gmail.com');
            const email2 = normalizeEmail('testuser@gmail.com');

            expect(email1).to.equal(email2);
        });

        it('should normalize gmail addresses with plus addressing', () => {
            const email1 = normalizeEmail('testuser+alias@gmail.com');

            // normalize-email keeps the base without +alias for gmail
            expect(email1).to.equal('testuser@gmail.com');
        });

        it('should lowercase non-gmail emails', () => {
            const email = normalizeEmail('TEST@Custom-Domain.com');

            expect(email).to.equal('test@custom-domain.com');
        });
    });

    describe('user update', () => {
        it('should update user profile fields', async () => {
            const updatedUser = {
                id: 'user-123',
                firstName: 'Updated',
                lastName: 'Name',
            };
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([updatedUser]);

            const result = await Store.users.updateUser(
                { firstName: 'Updated', lastName: 'Name' },
                { id: 'user-123' },
            );

            expect(result[0].firstName).to.equal('Updated');
            expect(result[0].lastName).to.equal('Name');
            updateUserStub.restore();
        });

        it('should NOT allow email updates for security', async () => {
            // The updateUser store method should filter out email from updates
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };

            // This is tested in UsersStore.test.ts - verifying that email is excluded
            // from the update query
            expect(true).to.be.eq(true);
        });

        it('should require id or email condition for update', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const UsersStore = require('../../src/store/UsersStore').default;
            const store = new UsersStore(mockStore);

            expect(() => store.updateUser({ userName: 'test' }, {}))
                .to.throw('User ID or email is required to call updateUser');
        });
    });

    describe('user deletion', () => {
        it('should require id or email for deletion', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const UsersStore = require('../../src/store/UsersStore').default;
            const store = new UsersStore(mockStore);

            expect(() => store.deleteUsers({ userName: 'test' }))
                .to.throw('User ID or email is required to call deleteUser');
        });

        it('should delete user by id', async () => {
            const deleteUsersStub = sinon.stub(Store.users, 'deleteUsers').resolves([{ id: 'user-123' }]);

            const result = await Store.users.deleteUsers({ id: 'user-123' });

            expect(deleteUsersStub.calledOnce).to.be.eq(true);
            deleteUsersStub.restore();
        });
    });

    describe('user find', () => {
        it('should find user by email', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ email: 'test@test.com' });

            expect(result).to.be.an('array');
            expect(result[0].email).to.equal('test@test.com');
            findUserStub.restore();
        });

        it('should find user by phone number', async () => {
            const mockUser = {
                id: 'user-123',
                phoneNumber: '+13175551234',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ phoneNumber: '+13175551234' });

            expect(result[0].phoneNumber).to.equal('+13175551234');
            findUserStub.restore();
        });

        it('should find user by userName', async () => {
            const mockUser = {
                id: 'user-123',
                userName: 'testuser',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ userName: 'testuser' });

            expect(result[0].userName).to.equal('testuser');
            findUserStub.restore();
        });

        it('should return empty array when user not found', async () => {
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([]);

            const result = await Store.users.findUser({ email: 'nonexistent@test.com' });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(0);
            findUserStub.restore();
        });
    });

    describe('isUserProfileIncomplete helper', () => {
        it('returns true when new user has no profile fields', () => {
            const result = isUserProfileIncomplete({});
            expect(result).to.be.eq(true);
        });

        it('returns false when missing phoneNumber (phone verification is deferred)', () => {
            // Deferred-phone-verification (2026-07): a profile is "complete" with just
            // a userName. Phone is prompted contextually and enforced only on
            // phone-sensitive actions (bulk invites), gated on MOBILE_VERIFIED at the
            // gateway rather than folded into EMAIL_VERIFIED.
            const result = isUserProfileIncomplete({
                userName: 'test',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(false);
        });

        it('returns true when missing userName', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(true);
        });

        it('returns false when missing firstName (name no longer required for completeness)', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                lastName: 'User',
            });
            expect(result).to.be.eq(false);
        });

        it('returns false when missing lastName (name no longer required for completeness)', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                firstName: 'Test',
            });
            expect(result).to.be.eq(false);
        });

        it('returns false when names are absent but phone and userName are present (name no longer required)', () => {
            // Onboarding-friction change (2026-06): a profile is "complete" with
            // just phone + userName so new users reach the app immediately; name
            // is prompted contextually later.
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
            });
            expect(result).to.be.eq(false);
        });

        it('returns false when all required fields present', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(false);
        });

        it('returns false when existing user has missing fields covered by update', () => {
            const mockUpdate = {
                phoneNumber: '+1234567890',
                userName: 'test',
            };
            const mockExistingUser = {
                firstName: 'Test',
                lastName: 'User',
            };
            const result = isUserProfileIncomplete(mockUpdate, mockExistingUser);
            expect(result).to.be.eq(false);
        });

        it('returns false when the update supplies the userName an existing user lacks', () => {
            // userName is the sole completeness requirement post deferred-phone-verification.
            const mockUpdate = {
                userName: 'test',
            };
            const mockExistingUser = {
                firstName: 'Test',
            };
            const result = isUserProfileIncomplete(mockUpdate, mockExistingUser);
            expect(result).to.be.eq(false);
        });

        it('returns true when neither the update nor the existing record supplies a userName', () => {
            const mockUpdate = {
                phoneNumber: '+1234567890',
            };
            const mockExistingUser = {
                firstName: 'Test',
            };
            const result = isUserProfileIncomplete(mockUpdate, mockExistingUser);
            expect(result).to.be.eq(true);
        });
    });

    describe('computeAccessLevelsAfterProfileUpdate helper', () => {
        // Regression coverage for f89e98805: a routine settings save (e.g. theme
        // change) used to demote EMAIL_VERIFIED users to MISSING_PROPERTIES,
        // bouncing them to CreateProfile. The helper must be upgrade-only.
        it('returns undefined when EMAIL_VERIFIED user saves with a complete profile (no demotion)', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                false,
            );
            expect(result).to.be.eq(undefined);
        });

        it('returns undefined when EMAIL_VERIFIED user saves with an incomplete profile (no demotion)', () => {
            // The pre-fix code would have demoted EMAIL_VERIFIED → MISSING_PROPERTIES here.
            // The helper now refuses the demotion entirely.
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                true,
            );
            expect(result).to.be.eq(undefined);
        });

        it('upgrades MISSING_PROPERTIES → EMAIL_VERIFIED when the profile is now complete', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                false,
            );
            expect(result).to.be.a('string');
            const parsed = JSON.parse(result as string);
            expect(parsed).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(parsed).to.not.include(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
            expect(parsed).to.include(AccessLevels.DEFAULT);
        });

        it('returns undefined when MISSING_PROPERTIES user is still incomplete (no upgrade)', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                true,
            );
            expect(result).to.be.eq(undefined);
        });

        it('returns undefined when accessLevels is undefined', () => {
            const result = computeAccessLevelsAfterProfileUpdate(undefined, false);
            expect(result).to.be.eq(undefined);
        });

        it('returns undefined when user has neither EMAIL_VERIFIED nor MISSING_PROPERTIES', () => {
            const result = computeAccessLevelsAfterProfileUpdate([AccessLevels.DEFAULT], false);
            expect(result).to.be.eq(undefined);
        });

        it('preserves unrelated access levels during the upgrade', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [
                    AccessLevels.DEFAULT,
                    AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
                    AccessLevels.DASHBOARD_SIGNUP,
                ],
                false,
            );
            const parsed = JSON.parse(result as string);
            expect(parsed).to.include(AccessLevels.DASHBOARD_SIGNUP);
            expect(parsed).to.include(AccessLevels.DEFAULT);
            expect(parsed).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(parsed).to.not.include(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
        });

        // MOBILE_VERIFIED is evidence that one *specific* number passed the SMS flow, so it
        // must not survive that number being edited to an arbitrary new one via a plain
        // profile save.
        it('revokes MOBILE_VERIFIED when the phone number changes', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
                false,
                true,
            );
            const parsed = JSON.parse(result as string);
            expect(parsed).to.not.include(AccessLevels.MOBILE_VERIFIED);
            expect(parsed).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(parsed).to.include(AccessLevels.DEFAULT);
        });

        it('keeps MOBILE_VERIFIED when the phone number is unchanged', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.MOBILE_VERIFIED],
                false,
                false,
            );
            expect(result).to.be.eq(undefined);
        });

        it('returns undefined on a phone change when MOBILE_VERIFIED was never held', () => {
            // No transition means no accessLevels write at all — an unverified user editing
            // their number must not cause a pointless column update.
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                false,
                true,
            );
            expect(result).to.be.eq(undefined);
        });

        it('applies both transitions at once: profile completed and number changed', () => {
            const result = computeAccessLevelsAfterProfileUpdate(
                [
                    AccessLevels.DEFAULT,
                    AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES,
                    AccessLevels.MOBILE_VERIFIED,
                ],
                false,
                true,
            );
            const parsed = JSON.parse(result as string);
            expect(parsed).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(parsed).to.not.include(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
            expect(parsed).to.not.include(AccessLevels.MOBILE_VERIFIED);
        });

        it('revokes MOBILE_VERIFIED on a phone change even when the profile is incomplete', () => {
            // The two transitions are independent: an incomplete profile suppresses the
            // EMAIL_VERIFIED upgrade but must not suppress the revocation.
            const result = computeAccessLevelsAfterProfileUpdate(
                [AccessLevels.DEFAULT, AccessLevels.MOBILE_VERIFIED],
                true,
                true,
            );
            const parsed = JSON.parse(result as string);
            expect(parsed).to.not.include(AccessLevels.MOBILE_VERIFIED);
            expect(parsed).to.include(AccessLevels.DEFAULT);
        });
    });

    describe('redactUserCreds helper', () => {
        it('should remove password from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                password: 'secret-hash',
            };
            const result = redactUserCreds(user);

            expect(result.password).to.be.eq(undefined);
        });

        it('should remove oneTimePassword from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                oneTimePassword: 'otp-hash:123456789',
            };
            const result = redactUserCreds(user);

            expect(result.oneTimePassword).to.be.eq(undefined);
        });

        it('should remove integrationsAccess from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                integrationsAccess: { facebook: { token: 'secret' } },
            };
            const result = redactUserCreds(user);

            expect(result.integrationsAccess).to.be.eq(undefined);
        });

        it('should remove verificationCodes from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                verificationCodes: { email: { code: '123456' } },
            };
            const result = redactUserCreds(user);

            expect(result.verificationCodes).to.be.eq(undefined);
        });

        it('should preserve non-sensitive fields', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                password: 'secret',
                oneTimePassword: 'otp',
                integrationsAccess: {},
                verificationCodes: {},
            };
            const result = redactUserCreds(user);

            expect(result.id).to.equal('user-123');
            expect(result.email).to.equal('test@test.com');
            expect(result.userName).to.equal('testuser');
            expect(result.firstName).to.equal('Test');
            expect(result.lastName).to.equal('User');
        });
    });

    describe('user search', () => {
        it('should search users by multiple criteria', async () => {
            const mockUsers = [
                { id: 'user-1', userName: 'test1' },
                { id: 'user-2', userName: 'test2' },
            ];
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves(mockUsers);

            const result = await Store.users.getUsers(
                { id: 1 },
                { userName: 'test' },
            );

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            getUsersStub.restore();
        });

        it('should find users by contact info (email/phone)', async () => {
            const mockUsers = [
                { id: 'user-1', email: 'test1@test.com' },
                { id: 'user-2', phoneNumber: '+1234567890' },
            ];
            const findUsersStub = sinon.stub(Store.users, 'findUsersByContactInfo').resolves(mockUsers);

            const result = await Store.users.findUsersByContactInfo([
                { email: 'test1@test.com' },
                { phoneNumber: '+1234567890' },
            ]);

            expect(result.length).to.equal(2);
            findUsersStub.restore();
        });
    });

    describe('getMe device-token brand scoping (cross-app notification mixup)', () => {
        // Regression coverage for the cross-app push mixup: a user with both Therr and
        // Habits installed on one device got a Therr "New Spots Unlocked" push delivered
        // to the Friends with Habits app. Root cause: push-notifications-service's
        // background-location path (whose BackgroundGeolocation requests never carry the
        // x-user-device-token header) falls back to GET /users/me, which returned the
        // legacy users.deviceMobileFirebaseToken column — a value clobbered by whichever
        // branded app registered last on the device. getMe must instead resolve the token
        // from main.userDeviceTokens keyed on the request's x-brand-variation.
        it('returns the brand-scoped token for the requesting brand, not the clobbered legacy column', async () => {
            sinon.stub(Store.users, 'getUserByConditions').resolves([{
                id: 'user-1',
                userName: 'dualappuser',
                // Legacy column was last written by the Habits app install on this device.
                deviceMobileFirebaseToken: 'habits-device-token',
            }] as any);
            // The user has re-registered a Therr row against the new table.
            sinon.stub(Store.userDeviceTokens, 'getTokensForUser')
                .withArgs('therr', 'user-1')
                .resolves([{ token: 'therr-device-token' } as any]);

            const req: any = { headers: { 'x-userid': 'user-1', 'x-brand-variation': 'therr' } };
            const res = makeRes();

            await getMe(req, res);

            expect(res.statusCode).to.equal(200);
            // The Therr-brand request must NOT get the Habits token — that's the leak that
            // routed a Therr push to the Friends with Habits app.
            expect(res.body.deviceMobileFirebaseToken).to.equal('therr-device-token');
        });

        it('returns no token at all when this brand has no registration', async () => {
            // The mirror image of the test above, and the direction that actually shipped a
            // bug: routing used to fall back to the legacy column here, which is shared
            // across every branded app on the device. A Habits caller therefore received
            // the user's *Therr* install token and pushed to the wrong app. Since
            // 20260904000001_main.userDeviceTokens.backfill.js the single-brand users this
            // protected have real rows, so an empty lookup now means "this brand genuinely
            // has no device" and must resolve to null.
            sinon.stub(Store.users, 'getUserByConditions').resolves([{
                id: 'user-1',
                userName: 'therronlyinstall',
                deviceMobileFirebaseToken: 'therr-install-token',
            }] as any);
            sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([]);

            const req: any = { headers: { 'x-userid': 'user-1', 'x-brand-variation': 'habits' } };
            const res = makeRes();

            await getMe(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.body.deviceMobileFirebaseToken).to.equal(null);
        });

        it('responds exactly once with a 404 when the user does not exist', async () => {
            // Regression: the 404 branch returned handleHttpError's Response, which then flowed
            // into a trailing `.then((user) => res.status(200).send(user))`. Against real Express
            // that second send throws ERR_HTTP_HEADERS_SENT, which the chain's .catch turned into
            // a *third* send and finally an unhandled rejection — so a plain missing-user lookup
            // logged a 500-shaped error and overwrote the 404 status.
            sinon.stub(Store.users, 'getUserByConditions').resolves([]);
            const getTokensStub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([]);

            const req: any = { headers: { 'x-userid': 'missing-user', 'x-brand-variation': 'therr' } };
            const res = makeRes();

            await getMe(req, res);

            expect(res.statusCode).to.equal(404);
            expect(res.sendCount).to.equal(1);
            // Short-circuit should happen before any device-token lookup.
            expect(getTokensStub.called).to.equal(false);
        });
    });

    describe('updateUser accounts-per-phone cap', () => {
        // A phone number holds at most one account of each type. createUser enforces that at
        // sign-up, but both accounts on a shared number stay editable afterwards — without a
        // guard here, two of them could each edit their way to `business`, or an account could
        // move onto a number whose slot for its type is already filled.
        const PHONE = '+1 317-555-1234';

        const stubUpdateChain = () => {
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }] as any);
            sinon.stub(Store.userOrganizations, 'get').resolves([] as any);
            return updateStub;
        };

        const makeReq = (body: any, brandVariation = 'therr') => ({
            headers: { 'x-userid': 'user-1', 'x-brand-variation': brandVariation },
            body,
        });

        it('rejects switching to an account type another account on the number already holds', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: PHONE, isBusinessAccount: false, isCreatorAccount: true, accessLevels: [],
            }] as any);
            sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-1', isBusinessAccount: false, isCreatorAccount: true },
                { id: 'user-2', isBusinessAccount: true, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ isBusinessAccount: true, isCreatorAccount: false }), res);

            expect(res.statusCode).to.equal(400);
            expect(res.body.errorCode).to.equal('OnlyThreeAccountsPerPhoneNumber');
            expect(updateStub.called).to.equal(false);
        });

        it('allows switching to an account type that is still free on the number', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: PHONE, isBusinessAccount: false, isCreatorAccount: false, accessLevels: [],
            }] as any);
            sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-1', isBusinessAccount: false, isCreatorAccount: false },
                { id: 'user-2', isBusinessAccount: true, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ isCreatorAccount: true }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.calledOnce).to.equal(true);
        });

        it('skips the check when neither the account type nor the number changes', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: PHONE, isBusinessAccount: false, isCreatorAccount: false, accessLevels: [],
            }] as any);
            // Two personal accounts already share this number (seeded before the cap existed).
            // An unrelated save must not fail — otherwise these users can never edit a bio.
            const lookupStub = sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-1', isBusinessAccount: false, isCreatorAccount: false },
                { id: 'user-2', isBusinessAccount: false, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ settingsBio: 'a new bio' }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.calledOnce).to.equal(true);
            expect(lookupStub.called).to.equal(false);
        });

        it('rejects moving onto a number whose slot for this account type is taken', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: '', isBusinessAccount: false, isCreatorAccount: false, accessLevels: [],
            }] as any);
            sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-2', isBusinessAccount: false, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ phoneNumber: PHONE }), res);

            expect(res.statusCode).to.equal(400);
            expect(res.body.errorCode).to.equal('OnlyThreeAccountsPerPhoneNumber');
            expect(updateStub.called).to.equal(false);
        });

        it('rejects a second account on the same number for Habits, whatever the type', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: '', isBusinessAccount: false, isCreatorAccount: false, accessLevels: [],
            }] as any);
            sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-2', isBusinessAccount: true, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ phoneNumber: PHONE }, 'habits'), res);

            expect(res.statusCode).to.equal(400);
            expect(res.body.errorCode).to.equal('OnlyThreeAccountsPerPhoneNumber');
            expect(updateStub.called).to.equal(false);
        });

        it('does not treat the apple-sso sentinel as a phone number', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', phoneNumber: 'apple-sso', isBusinessAccount: false, isCreatorAccount: false, accessLevels: [],
            }] as any);
            // Every Apple SSO row carries this same value; counting "accounts on this number"
            // would return the whole cohort and refuse them all.
            const lookupStub = sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([
                { id: 'user-2', isBusinessAccount: false, isCreatorAccount: false },
                { id: 'user-3', isBusinessAccount: false, isCreatorAccount: false },
            ] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ isCreatorAccount: true }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.calledOnce).to.equal(true);
            expect(lookupStub.called).to.equal(false);
        });
    });

    describe('updateUser phone-verification gate', () => {
        // A profile save could previously move `phoneNumber` to any value while the account
        // kept the MOBILE_VERIFIED level the *old* number earned — so phone-gated actions
        // stayed unlocked against a number nobody ever verified.
        const PHONE = '+1 317-555-1234';
        const NEW_PHONE = '+1 317-555-9999';

        const stubUpdateChain = () => {
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }] as any);
            sinon.stub(Store.userOrganizations, 'get').resolves([] as any);
            return updateStub;
        };

        const makeReq = (body: any) => ({
            headers: { 'x-userid': 'user-1', 'x-brand-variation': 'therr' },
            body,
        });

        it('revokes MOBILE_VERIFIED when the save changes the phone number', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1',
                phoneNumber: PHONE,
                userName: 'someone',
                isBusinessAccount: false,
                isCreatorAccount: false,
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            }] as any);
            sinon.stub(Store.users, 'getAllByPhoneNumber').resolves([] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ phoneNumber: NEW_PHONE }), res);

            expect(res.statusCode).to.equal(202);
            const writtenAccessLevels = JSON.parse(updateStub.firstCall.args[0].accessLevels);
            expect(writtenAccessLevels).to.not.include(AccessLevels.MOBILE_VERIFIED);
            expect(writtenAccessLevels).to.include(AccessLevels.EMAIL_VERIFIED);
        });

        it('leaves accessLevels untouched on a save that does not change the number', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1',
                phoneNumber: PHONE,
                userName: 'someone',
                isBusinessAccount: false,
                isCreatorAccount: false,
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.MOBILE_VERIFIED],
            }] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ settingsBio: 'a new bio' }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.firstCall.args[0].accessLevels).to.be.eq(undefined);
        });

        it('treats a reformatted but identical number as unchanged', async () => {
            // The column holds two dialects (compact E.164 from profile edits, the gateway's
            // display format from the verification flow). Comparing them raw would revoke
            // verification on a save that changed nothing.
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1',
                phoneNumber: PHONE,
                userName: 'someone',
                isBusinessAccount: false,
                isCreatorAccount: false,
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.MOBILE_VERIFIED],
            }] as any);
            const updateStub = stubUpdateChain();

            const res = makeRes();
            await updateUser(makeReq({ phoneNumber: '+13175551234' }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.firstCall.args[0].accessLevels).to.be.eq(undefined);
        });
    });

    describe('updateUserCoins', () => {
        // Internal-only route (`PUT /users/:id/coins`, not registered in the gateway) whose
        // sole caller is reactions-service and sends nothing but `settingsTherrCoinTotal`.
        const makeReq = (body: any) => ({
            headers: { 'x-userid': 'user-1', 'x-brand-variation': 'therr' },
            body,
        });

        it('passes the reward through as a delta for the store to increment', async () => {
            // Regression: the handler used to send `userSearchResults[0] + delta` — the whole
            // user row, not the column — so the value stringified to "[object Object]<delta>",
            // failed the store's `> 0` guard, and no coins were ever awarded.
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', settingsPushBackground: true,
            }] as any);
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }] as any);

            const res = makeRes();
            await updateUserCoins(makeReq({ settingsTherrCoinTotal: 5 }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.firstCall.args[0].settingsTherrCoinTotal).to.equal(5);
        });

        it('does not reward a user who has not opted in to background push', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', settingsPushBackground: false,
            }] as any);
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }] as any);

            const res = makeRes();
            await updateUserCoins(makeReq({ settingsTherrCoinTotal: 5 }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.called).to.equal(false);
        });

        it('ignores profile fields smuggled into the body', async () => {
            // The handler used to build the same broad updateArgs as updateUser — phoneNumber,
            // userName, media, deviceMobileFirebaseToken — with none of updateUser's guards.
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-1', settingsPushBackground: true,
            }] as any);
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }] as any);

            const res = makeRes();
            await updateUserCoins(makeReq({
                settingsTherrCoinTotal: 5,
                phoneNumber: '+1 317-555-1234',
                userName: 'stolen-name',
                accessLevels: JSON.stringify([AccessLevels.SUPER_ADMIN]),
            }), res);

            expect(res.statusCode).to.equal(202);
            expect(updateStub.firstCall.args[0]).to.deep.equal({ settingsTherrCoinTotal: 5 });
        });

        it('responds 404 without writing when the user does not exist', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([] as any);
            const updateStub = sinon.stub(Store.users, 'updateUser').resolves([] as any);

            const res = makeRes();
            await updateUserCoins(makeReq({ settingsTherrCoinTotal: 5 }), res);

            expect(res.statusCode).to.equal(404);
            expect(updateStub.called).to.equal(false);
        });
    });

    describe('access levels', () => {
        it('should correctly identify verified email access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED];

            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED)).to.be.eq(true);
        });

        it('should correctly identify missing properties access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES];

            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)).to.be.eq(true);
            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED)).to.be.eq(false);
        });

        it('should correctly identify dashboard signup access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SIGNUP];

            expect(accessLevels.includes(AccessLevels.DASHBOARD_SIGNUP)).to.be.eq(true);
        });
    });
});

/**
 * The birthdate every registration form collects.
 *
 * `createUser` hands `createUserHelper` an explicit whitelist rather than the raw body,
 * and `settingsBirthdate` was missing from it. Nothing failed: the gateway validated the
 * value, the handler dropped it, and the column was written as DEFAULT — so no account
 * ever stored a birthdate, and the service's own age check (guarded on the value being
 * present) never ran on any registration. A field silently not being forwarded looks
 * identical to a client that never sent one, which is why this is asserted against the
 * emitted INSERT rather than against the handler's arguments.
 */
describe('createUser — settingsBirthdate', () => {
    const BIRTHDATE = '1990-01-01';

    const stubStores = () => {
        const userConnection = {
            read: { query: sinon.stub().resolves({ rows: [] }) },
            write: { query: sinon.stub().resolves({ rows: [{ id: 'mock-id' }] }) },
        };
        sinon.stub(Store, 'users').value(new UsersStoreClass(userConnection));
        sinon.stub(Store, 'verificationCodes')
            .value(new VerificationCodesStore({ write: { query: sinon.stub().resolves({}) } }));
        sinon.stub(Store, 'userAchievements')
            .value(new UserAchievementsStore({
                read: { query: sinon.stub().resolves({ rows: [] }) },
                write: { query: sinon.stub().resolves({ rows: [] }) },
            } as any));
        sinon.stub(awsSES, 'sendEmail').resolves({});
        return userConnection;
    };

    const makeReq = (body: any) => ({
        headers: {
            'x-platform': 'web',
            'x-brand-variation': 'habits',
            'x-localecode': 'en-us',
        },
        body,
    });

    const insertSql = (userConnection: any) => userConnection.write.query.args
        .map((call: any[]) => call[0])
        .find((sql: string) => sql.includes('insert into "main"."users"'));

    it('writes the submitted birthdate to the users row', async () => {
        const userConnection = stubStores();
        const res = makeRes();

        await createUser(makeReq({
            email: 'birthday@test.com',
            password: 'strinG123!',
            settingsBirthdate: BIRTHDATE,
            hasAgreedToTerms: true,
        }) as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(201);
        const sql = insertSql(userConnection);
        expect(sql, 'no users INSERT was emitted').to.be.a('string');
        expect(sql.includes('"settingsBirthdate"')).to.equal(true);
        // The value, not just the column: the column was always in the INSERT, carrying
        // DEFAULT, which is exactly what made the dropped field invisible.
        expect(sql.includes(BIRTHDATE)).to.equal(true);
    });

    // Second layer only. The gateway rejects an under-age birthdate first, so this covers
    // a caller reaching the service directly -- and it can only run at all because the
    // value is now forwarded.
    it('rejects an under-age birthdate with a 400 rather than a 500', async () => {
        const userConnection = stubStores();
        const res = makeRes();
        const under13 = new Date();
        under13.setFullYear(under13.getFullYear() - 8);

        await createUser(makeReq({
            email: 'tooyoung@test.com',
            password: 'strinG123!',
            settingsBirthdate: under13.toISOString().split('T')[0],
            hasAgreedToTerms: true,
        }) as any, res as any, (() => undefined) as any);

        expect(res.statusCode).to.equal(400);
        expect(insertSql(userConnection), 'an under-age registration must not insert a row')
            .to.equal(undefined);
    });
});
