/**
 * Unit Tests for users-service request validation chains.
 *
 * Runs the actual express-validator chains against mock requests and asserts on
 * the collected validationResult — i.e. it exercises real validator behavior
 * rather than re-stating constants.
 */
import { expect } from 'chai';
import { validationResult } from 'express-validator';
import { updateUserValidation } from '../../../../src/services/users/validation/users';

// A valid version-4 UUID (3rd group starts with '4', variant nibble is 'a').
const VALID_V4_UUID = '550e8400-e29b-41d4-a716-446655440000';

const runValidation = async (chains: any[], req: any) => {
    for (let i = 0; i < chains.length; i += 1) {
        // express-validator chains mutate the request in place; run sequentially.
        await chains[i].run(req); // eslint-disable-line no-await-in-loop
    }
    return validationResult(req);
};

const buildReq = (overrides: any = {}) => ({
    params: { id: VALID_V4_UUID },
    query: {},
    body: {},
    ...overrides,
});

describe('updateUserValidation', () => {
    it('accepts empty-string phoneNumber and email (SSO accounts persist these as "")', async () => {
        // Regression: a bare `.optional()` only skips undefined/null, so an empty-string
        // phoneNumber/email would fail isMobilePhone/isEmail and 400 the entire update.
        // The deployed mobile Settings/CreateProfile screens send user.details.phoneNumber
        // (== '' for Apple/Google SSO users), so this must pass.
        const req = buildReq({
            body: {
                email: '',
                phoneNumber: '',
                firstName: 'Ada',
                lastName: 'Lovelace',
            },
        });

        const result = await runValidation(updateUserValidation, req);

        expect(result.isEmpty(), JSON.stringify(result.array())).to.be.eq(true);
    });

    it('accepts a well-formed phoneNumber and email', async () => {
        const req = buildReq({
            body: {
                email: 'ada@example.com',
                phoneNumber: '+14155552671',
            },
        });

        const result = await runValidation(updateUserValidation, req);

        expect(result.isEmpty(), JSON.stringify(result.array())).to.be.eq(true);
    });

    it('still rejects a non-empty but malformed email', async () => {
        const req = buildReq({
            body: { email: 'not-an-email' },
        });

        const result = await runValidation(updateUserValidation, req);

        expect(result.isEmpty()).to.be.eq(false);
        expect(result.array().some((e: any) => e.path === 'email')).to.be.eq(true);
    });

    it('still rejects a non-empty but malformed phoneNumber', async () => {
        const req = buildReq({
            body: { phoneNumber: 'abc123' },
        });

        const result = await runValidation(updateUserValidation, req);

        expect(result.isEmpty()).to.be.eq(false);
        expect(result.array().some((e: any) => e.path === 'phoneNumber')).to.be.eq(true);
    });

    it('rejects a non-UUID id param', async () => {
        const req = buildReq({ params: { id: 'not-a-uuid' }, body: {} });

        const result = await runValidation(updateUserValidation, req);

        expect(result.isEmpty()).to.be.eq(false);
        expect(result.array().some((e: any) => e.path === 'id')).to.be.eq(true);
    });
});
