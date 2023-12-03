import { OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';

const passthroughAndLogErrors = (response) => {
    if (response?.data?.errors) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['facebook api error'],
            traceArgs: {
                'error.message': response?.data?.errors?.message,
                'error.code': response?.data?.errors?.code,
                'error.subcode': response?.data?.errors?.error_subcode,
                integration: OAuthIntegrationProviders.FACEBOOK,
                integration_trace_id: response?.data?.errors?.fbtrace_id,
            },
        });
    }

    return response;
};

const sanitizeMaxBudget = (budget?: number) => {
    if (budget) {
        return budget * 100;
    }

    return 922337203685478;
};

export {
    passthroughAndLogErrors,
    sanitizeMaxBudget,
};
