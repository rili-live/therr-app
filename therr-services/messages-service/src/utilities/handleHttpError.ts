import { configureHandleHttpError, IErrorArgs } from 'therr-js-utilities/http';

export {
    IErrorArgs,
};

const handleHttpError = configureHandleHttpError();

export default handleHttpError;
