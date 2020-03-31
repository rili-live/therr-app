import validator from 'validator';

const VALIDATIONS: any = {
    email: {
        errorMessageLocalizationKey: 'validations.email',
        regex: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/i, // eslint-disable-line max-len
        validator: validator.isEmail,
    },
    isRequired: {
        errorMessageLocalizationKey: 'validations.isRequired',
        regex: /^(?!\s*$).+/i,
    },
    lettersOnly: {
        errorMessageLocalizationKey: 'validations.lettersOnly',
        regex: /^$|^[a-zA-Z]*$/,
    },
    mobilePhoneNumber: {
        errorMessageLocalizationKey: 'validations.mobilePhoneNumber',
        validator: (value: any) => validator.isMobilePhone(value, 'any', { strictMode: true }),
    },
    numbersOnly: {
        errorMessageLocalizationKey: 'validations.numbersOnly',
        regex: /^$|^[0-9]*$/,
    },
};

export default VALIDATIONS;
