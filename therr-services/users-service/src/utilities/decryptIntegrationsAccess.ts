const decryptIntegrationsAccess = (access?: string | object) => {
    // eslint-disable-next-line eqeqeq
    if (access == undefined) {
        return {};
    }

    if (typeof access === 'string') {
        return JSON.parse(access);
    }

    return access;
};

export default decryptIntegrationsAccess;
