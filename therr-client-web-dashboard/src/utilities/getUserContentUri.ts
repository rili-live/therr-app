import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

const getUserContentUri = (media, size = 200) => `${envVars.baseApiGatewayRoute}/user-files/${media.path}`;

export default getUserContentUri;
