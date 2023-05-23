// TODO: Store this in a database
const blacklistedIps: string[] = [];
const blacklistedIpPrefixes: string[] = ['119.160.56', '119.160.57'];
const blacklistedEmails: string[] = [];
const blacklistedEmailSuffixes: string[] = ['secmail.org'];
const isBlacklisted = (ip) => {
    const isBadLocale = blacklistedIpPrefixes.some((prefix) => ip.startsWith(prefix));

    return isBadLocale || blacklistedIps.includes(ip);
};

export const isBlacklistedEmail = (email?: string) => {
    if (!email) {
        return false;
    }
    const isBadEmail = blacklistedEmailSuffixes.some((prefix) => email.endsWith(prefix));

    return isBadEmail || blacklistedEmails.includes(email);
};

export default isBlacklisted;
