import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
import globalConfig from '../../../../../global-config';

/**
 * Fans the account deletion out to every service that holds data keyed on the user.
 *
 * Each service exposes the same internal `DELETE /delete-user-data` contract and reads the
 * user from the forwarded `x-userid` header. Notifications live in this service and are
 * deleted directly by the `deleteUser` handler rather than over HTTP.
 *
 * `allSettled`, not `all`: a user is entitled to have their data removed everywhere it can
 * be removed, so one unreachable service must not cancel the rest. Every failure is logged
 * individually with the user id, because the row in main.users is already gone by this
 * point and a re-run cannot be derived from the database afterwards.
 */
const requestToDeleteUserData = (headers: InternalConfigHeaders) => {
    const targets = [
        { service: 'maps-service', url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/delete-user-data` },
        { service: 'reactions-service', url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/delete-user-data` },
        { service: 'messages-service', url: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}/delete-user-data` },
        // Websocket-service serves this off the container root, not a /v1 prefix.
        { service: 'websocket-service', url: `${globalConfig[process.env.NODE_ENV].baseWebsocketServiceRoute}/delete-user-data` },
    ];

    return Promise.allSettled(targets.map(({ url }) => internalRestRequest({
        headers,
    }, {
        method: 'delete',
        url,
        data: {},
    }))).then((results) => {
        const failures = results
            .map((result, index) => ({ result, service: targets[index].service }))
            .filter(({ result }) => result.status === 'rejected');

        failures.forEach(({ result, service }) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to delete user data'],
                traceArgs: {
                    'error.message': (result as PromiseRejectedResult).reason?.message,
                    'error.origin': 'requestToDeleteUserData',
                    'user.deletedId': headers['x-userid'],
                    'service.name': service,
                },
            });
        });

        return {
            deletedFrom: targets.length - failures.length,
            failedServices: failures.map(({ service }) => service),
        };
    });
};

export default requestToDeleteUserData;
