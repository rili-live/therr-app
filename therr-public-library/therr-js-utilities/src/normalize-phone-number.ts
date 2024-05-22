import { getNumberFrom, parsePhoneNumber } from 'awesome-phonenumber';

export default (abnormalPhoneNumber: string, regionCode?: string) => {
    // Note: `getNumber` requires a country code prefix or a supplied regionCode
    // we can't guess this because it could result in a mismatched phone number
    if (!abnormalPhoneNumber.includes('+') && !regionCode) {
        const pn = parsePhoneNumber(abnormalPhoneNumber, { regionCode: 'US' });

        if (pn.valid) {
            // TODO: We can't assume US, this is BAAAAD
            // This will append a US area codea at the beginning of the phone number
            return getNumberFrom(pn, 'US').number;
        }

        return abnormalPhoneNumber;
    }

    const pn = parsePhoneNumber(abnormalPhoneNumber, { regionCode });

    if (pn.valid) {
        // NOTE: When regionCode is provided, this method removes the area code
        // ...otherwise it keeps the area code
        return getNumberFrom(pn, regionCode).number;
    }

    return abnormalPhoneNumber;
};
