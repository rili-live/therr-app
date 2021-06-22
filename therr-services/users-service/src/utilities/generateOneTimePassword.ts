import generatePassword from 'password-generator';
import { PasswordRegex } from 'therr-js-utilities/constants';

function isStrongEnough(password) {
    return PasswordRegex.test(password);
}

export default (length): string => {
    let password = generatePassword(length, false, /[\w\d!@#$%^&*]/);

    while (!isStrongEnough(password)) {
        password = generatePassword(length, false, /[\w\d!@#$%^&*]/);
    }

    return password;
};
