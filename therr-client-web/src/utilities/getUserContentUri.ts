import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

const IMAGE_KIT_URL = 'https://ik.imagekit.io/qmtvldd7sl/';

// const getUserContentUri = (media) => `${envVars.baseApiGatewayRoute}/user-files/${media.path}`; // PRE-IMAGE_KIT
const getUserContentUri = (media) => `${IMAGE_KIT_URL}${media.path}`; // POST-IMAGE_KIT

export default getUserContentUri;
