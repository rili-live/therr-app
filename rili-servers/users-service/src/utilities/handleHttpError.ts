import { configureHandleHttpError, IErrorArgs } from 'rili-public-library/utilities/http.js';
import beeline from '../beeline';

export {
    IErrorArgs,
};

const handleHttpError = configureHandleHttpError(beeline);

export default handleHttpError;
