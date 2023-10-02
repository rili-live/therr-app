import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

const getUserContentUri = (media) => `${envVars.baseApiGatewayRoute}/user-files/${media.path}`;

export default getUserContentUri;
