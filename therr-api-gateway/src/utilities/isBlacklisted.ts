// TODO: Store this in a database
const blacklistedIps: string[] = [];
const blacklistedIpPrefixes: string[] = ['119.160.56', '119.160.57'];
const isBlacklisted = (ip) => {
    const isBadLocale = blacklistedIpPrefixes.some((prefix) => ip.startsWith(prefix));

    return isBadLocale || blacklistedIps.includes(ip);
};

export default isBlacklisted;
