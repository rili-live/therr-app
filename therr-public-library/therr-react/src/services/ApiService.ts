/* eslint-disable class-methods-use-this */
import axios from 'axios';

/**
 * One account the caller may sign into, as returned when a phone number is attached to more
 * than one (Therr permits a personal + creator + business account per number). Deliberately
 * narrow — it is rendered by a pre-auth account picker, so it carries nothing sensitive.
 */
export interface IPhoneAuthAccount {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    media?: any;
    isBusinessAccount?: boolean;
    isCreatorAccount?: boolean;
}

export interface IPhoneAuthVerifyArgs {
    phoneNumber: string;
    verificationCode: string;
    rememberMe?: boolean;
}

export interface IPhoneAuthSelectArgs {
    phoneVerificationToken: string;
    userId: string;
    rememberMe?: boolean;
}

class ApiService {
    /**
     * Sends a verification code to the phone number of an ALREADY SIGNED IN user, so they can
     * attach or change the number on their profile. For signed-out sign-in/sign-up use the
     * passwordless methods further down.
     */
    verifyPhone = (phoneNumber) => axios({
        method: 'post',
        url: '/phone/verify',
        data: {
            phoneNumber,
        },
    });

    validateCode = (verificationCode) => axios({
        method: 'post',
        url: '/phone/validate-code',
        data: {
            verificationCode,
        },
    });

    // PASSWORDLESS SIGN-IN
    //
    // The response to `startPhoneLogin` is intentionally identical whether or not an account
    // exists for the number — do not branch UI on it. Render the code-entry step either way
    // and let `verifyPhoneLogin` be the call that succeeds or fails.

    startPhoneLogin = (phoneNumber: string) => axios({
        method: 'post',
        url: '/phone/auth/start',
        data: {
            phoneNumber,
        },
    });

    /**
     * Submits the texted code. Resolves either with a full session payload (same shape as
     * `POST /users-service/auth`) or, when the number has several accounts, with
     * `{ requiresAccountSelection: true, accounts, phoneVerificationToken }` — pass that token
     * and the chosen account id to `selectPhoneLoginAccount`.
     */
    verifyPhoneLogin = (data: IPhoneAuthVerifyArgs) => axios({
        method: 'post',
        url: '/phone/auth/verify',
        data,
    });

    selectPhoneLoginAccount = (data: IPhoneAuthSelectArgs) => axios({
        method: 'post',
        url: '/phone/auth/select',
        data,
    });

    // PASSWORDLESS SIGN-UP

    startPhoneRegistration = (phoneNumber: string) => axios({
        method: 'post',
        url: '/phone/register/start',
        data: {
            phoneNumber,
        },
    });

    /**
     * Submits the texted code and resolves with a short-lived `phoneVerificationToken`. Pass
     * that token to `UsersService.create` alongside the email collected in the next step; the
     * account is then created already phone-verified.
     */
    verifyPhoneRegistration = (data: Omit<IPhoneAuthVerifyArgs, 'rememberMe'>) => axios({
        method: 'post',
        url: '/phone/register/verify',
        data,
    });
}

export default new ApiService();
