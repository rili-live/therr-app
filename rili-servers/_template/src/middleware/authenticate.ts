import unless from 'express-unless';
import { configureAuthenticate } from 'rili-public-library/utilities/middleware.js';
import handleHttpError from '../utilities/handleHttpError';

const authenticate = configureAuthenticate(handleHttpError);
authenticate.unless = unless;

export default authenticate;
