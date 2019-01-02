const VALIDATIONS: any = {
    isRequired: {
        errorMessageLocalizationKey: 'validations.isRequired',
        regex: /^(?!\s*$).+/,
    },
    lettersOnly: {
        errorMessageLocalizationKey: 'validations.lettersOnly',
        regex: /^$|^[a-zA-Z]*$/,
    },
    numbersOnly: {
        errorMessageLocalizationKey: 'validations.numbersOnly',
        regex: /^$|^[0-9]*$/,
    },
};

export default VALIDATIONS;
