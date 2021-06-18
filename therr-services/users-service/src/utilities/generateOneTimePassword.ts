import generatePassword from 'password-generator';
import { PasswordRegex } from 'therr-js-utilities/constants';

function isStrongEnough(password) {
    return PasswordRegex.test(password);
}

export default (length): string => {
    let password = generatePassword(length, false, /[\w\d!@#$%^&*]/);
    let count = 0;

    while (!isStrongEnough(password)) {
        count += 1;
        password = generatePassword(length, false, /[\w\d!@#$%^&*]/);
    }

    console.log(count);

    return password;
};
