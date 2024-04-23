import { getNumberFrom, parsePhoneNumber } from 'awesome-phonenumber';

export default (abnormalPhoneNumber: string, countryCode?: string) => {
    // Note: `getNumber` requires a country code prefix or a supplied countryCode
    // we can't guess this because it could result in a mismatched phone number
    if (!abnormalPhoneNumber.includes('+') && !countryCode) {
        const pn = parsePhoneNumber(abnormalPhoneNumber, { regionCode: 'US' });

        if (pn.valid) {
            // TODO: We can't assume US, this is BAAAAD
            return getNumberFrom(pn, 'US').number;
        }

        return abnormalPhoneNumber;
    }

    const pn = parsePhoneNumber(abnormalPhoneNumber, { regionCode: countryCode });

    if (pn.valid) {
        // TODO: We can't assume US, this is BAAAAD
        return getNumberFrom(pn, countryCode).number;
    }

    return abnormalPhoneNumber;
};
