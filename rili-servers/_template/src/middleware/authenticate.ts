import unless from 'express-unless';
import { configureAuthenticate } from 'rili-js-utilities/middleware';
import handleHttpError from '../utilities/handleHttpError';

const authenticate = configureAuthenticate(handleHttpError);
authenticate.unless = unless;

export default authenticate;
