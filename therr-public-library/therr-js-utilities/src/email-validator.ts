import emailValidator from 'email-validator';

export default class CustomEmailValidator {
    public static validate(email: string): boolean {
        if (email.endsWith('.vom') || email.endsWith('gmaol.com') || email.endsWith('sil.com') || email.endsWith('1secmail.org')) {
            return false;
        }
        return emailValidator.validate(email);
    }
}
