import * as bcrypt from 'bcrypt';
import translate from './translator';
import handleHttpError from './handleHttpError';

export interface IValidatePasswordArgs {
    hashedPassword?: string;
    locale: string;
    oneTimePassword?: string;
    inputPassword;
    res;
}

export default async ({
    hashedPassword,
    locale,
    oneTimePassword,
    inputPassword,
    res,
}: IValidatePasswordArgs) => {
    let isOtPasswordValid = false;

    // First check oneTimePassword if exists
    if (oneTimePassword) {
        const split = oneTimePassword.split(':');
        const otHashedPassword = split[0];
        const msExpiresAt = Number(split[1]);
        isOtPasswordValid = await bcrypt.compare(inputPassword, otHashedPassword);
        if (isOtPasswordValid && msExpiresAt <= Date.now()) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.auth.oneTimeExpired'),
                statusCode: 403,
            });
        }
    }

    return Promise.resolve()
        // Only compare user password if one-time password is null or incorrect
        .then(() => isOtPasswordValid || (!!hashedPassword && bcrypt.compare(inputPassword, hashedPassword)));
};
