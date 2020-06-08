
interface IValidation {
    regex?: RegExp;
    errorMessageLocalizationKey: string;
    validator?: any;
}

export default (validations: IValidation[], validationKey: any, value: any) => {
    const validation = validations[validationKey];
    if (validation.validator) {
        return validation.validator(value);
    }

    if (validation.regex) {
        return validations[validationKey].regex.test(value);
    }

    return new Error('Validation must have a regex or validator property defined.');
};
