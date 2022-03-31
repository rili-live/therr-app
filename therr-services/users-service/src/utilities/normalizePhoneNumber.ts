import PhoneNumber from 'awesome-phonenumber';

export default (abnormalPhoneNumber: string, countryCode?: string) => {
    // Note: `getNumber` requires a country code prefix or a supplied countryCode
    // we can't guess this because it could result in a mismatched phone number
    if (!abnormalPhoneNumber.includes('+') && !countryCode) {
        // TODO: We can't assume US, this is BAAAAD
        return new PhoneNumber(abnormalPhoneNumber, 'US').getNumber();
    }

    return new PhoneNumber(abnormalPhoneNumber, countryCode).getNumber();
};
