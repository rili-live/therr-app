import configureHandleHttpError, { IErrorArgs } from './configure-handle-http-error';
import handleHttpError, { asyncHandler, HandleHttpError } from './async-handler';
import getBrandContext, { IBrandContext } from './get-brand-context';
import getSearchQueryArgs, { IReqQuery } from './get-search-query-args';
import getSearchQueryString from './get-search-query-string';
import parseHeaders from './parse-headers';

// NOTE: The node keep-alive agents (httpKeepAliveAgent/httpsKeepAliveAgent) intentionally
// live in './agents' and are NOT re-exported here. They statically import node's `http`/`https`
// and construct Agents at module load, which would drag node-only code into this isomorphic
// barrel — and from there into the frontend bundle (therr-react/lib/services.js), breaking the
// React Native (Metro) build, which cannot resolve `https`. The agents stay an internal module:
// './internal-rest-request' bundles them for inter-service calls, and other backend consumers
// (e.g. the API gateway) construct their own node agents directly.

export {
    configureHandleHttpError,
    handleHttpError,
    asyncHandler,
    HandleHttpError,
    IErrorArgs,
    IReqQuery,
    getBrandContext,
    IBrandContext,
    getSearchQueryArgs,
    getSearchQueryString,
    parseHeaders,
};
