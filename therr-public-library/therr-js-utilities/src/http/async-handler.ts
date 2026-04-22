import type { RequestHandler } from 'express';
import configureHandleHttpError, { IErrorArgs } from './configure-handle-http-error';

/**
 * A single shared `handleHttpError` instance, pre-configured with no args.
 *
 * Previously each service defined its own wrapper in
 * `src/utilities/handleHttpError.ts` that called `configureHandleHttpError()`
 * at module-load. Those wrappers are byte-identical because the factory takes
 * no arguments; the per-service copies produced duplicate closures that
 * behaved identically. This singleton collapses them to one instance without
 * changing response shape or tracing behavior — `configureHandleHttpError` is
 * a pure factory that returns a stateless function, so sharing is safe.
 */
const handleHttpError: (args: IErrorArgs) => any = configureHandleHttpError();

export type HandleHttpError = typeof handleHttpError;

/**
 * Wraps an Express handler (sync or async) so rejected promises / thrown
 * errors are routed through `handleHttpError` with a contextual label, instead
 * of requiring an explicit `.catch(err => handleHttpError({...}))` on every
 * promise chain. Adoption is opt-in and non-breaking: existing handlers that
 * already catch their own errors continue to work unchanged.
 *
 * @example
 *   router.get('/spaces/:id', asyncHandler('SPACES:GET', async (req, res) => {
 *       const space = await Store.spaces.get(req.params.id);
 *       return res.status(200).send(space);
 *   }));
 *
 * @param context  A short, grep-able label embedded in the error message
 *                 (e.g. `'REACTIONS:CREATE_SPACE_REACTION'`). Replaces the
 *                 generic `'SQL:*_ROUTES:ERROR'` strings that appear in ~100+
 *                 per-handler catch blocks today.
 * @param handler  The route handler. May return a Promise; the return value
 *                 is ignored — respond via `res` as usual.
 * @param onError  Optional override of the error responder, for services that
 *                 bind their own pre-configured `handleHttpError`. Defaults to
 *                 the shared singleton above.
 */
export const asyncHandler = (
    context: string,
    handler: (req: any, res: any, next: any) => any,
    onError: HandleHttpError = handleHttpError,
): RequestHandler => (req, res, next) => {
    Promise.resolve()
        .then(() => handler(req, res, next))
        .catch((err: Error) => onError({
            err,
            res,
            message: `${context}:ERROR`,
        }));
};

export default handleHttpError;
