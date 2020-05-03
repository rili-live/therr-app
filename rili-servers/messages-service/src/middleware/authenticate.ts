import { configureAuthenticate } from 'rili-public-library/utilities/middleware.js';
import handleHttpError from '../utilities/handleHttpError';

export default configureAuthenticate(handleHttpError);
