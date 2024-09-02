const parseHeaders = (headers: { [key: string]: any }) => {
    const authorization = headers.authorization;
    const locale = headers['x-localecode'] || 'en-us';
    const platform = headers['x-platform'] || '';
    const brandVariation = headers['x-brand-variation'] || '';
    const requestId = headers['x-requestid'] || '';
    let userAccessLevels = [];
    const userDeviceToken = headers['x-user-device-token'] || '';
    const userId = headers['x-userid'] || '';
    const userName = headers['x-username'] || '';
    let userOrgsAccess = {};
    const whiteLabelOrigin = headers['x-therr-origin-host'] || '';

    try {
        userAccessLevels = JSON.parse(headers['x-user-access-levels'] || '[]');
        userOrgsAccess = JSON.parse(headers['x-organizations'] || '{}');
    } catch (e) {
        console.warn('Failed to parse x-user-access-levels OR x-organizations header', e);
    }

    return {
        authorization,
        locale,
        platform,
        brandVariation,
        requestId,
        userAccessLevels,
        userDeviceToken,
        userId,
        userName,
        userOrgsAccess,
        whiteLabelOrigin,
    };
};

export default parseHeaders;
