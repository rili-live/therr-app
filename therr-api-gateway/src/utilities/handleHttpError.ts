// Thin re-export of the shared singleton from therr-js-utilities/http.
// Previously this file called `configureHandleHttpError()` directly; that
// factory takes no arguments and returns a stateless closure, so every
// service was constructing an identical function. The shared export lets all
// services and handlers reference the same instance without changing any
// call sites that import from this path.
import { handleHttpError, IErrorArgs } from 'therr-js-utilities/http';

export { IErrorArgs };
export default handleHttpError;
