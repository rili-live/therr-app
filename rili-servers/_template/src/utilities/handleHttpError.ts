import { configureHandleHttpError, IErrorArgs } from 'rili-js-utilities/http';
import beeline from '../beeline';

export {
    IErrorArgs,
};

const handleHttpError = configureHandleHttpError(beeline);

export default handleHttpError;
