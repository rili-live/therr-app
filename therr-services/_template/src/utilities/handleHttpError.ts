// Thin re-export of the shared singleton from therr-js-utilities/http.
// New services scaffolded from this template inherit the consolidated pattern
// automatically — do not re-introduce a per-service `configureHandleHttpError()`
// call here.
import { handleHttpError, IErrorArgs } from 'therr-js-utilities/http';

export { IErrorArgs };
export default handleHttpError;
