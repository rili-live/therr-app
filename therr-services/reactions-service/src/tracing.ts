import { NodeSDK } from '@opentelemetry/sdk-node';
import { HoneycombSDK } from '@honeycombio/opentelemetry-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Uses environment variables named HONEYCOMB_API_KEY and OTEL_SERVICE_NAME
const sdk: NodeSDK = new HoneycombSDK({
    serviceName: 'reactions-service',
    instrumentations: [
        getNodeAutoInstrumentations({
            // We recommend disabling fs automatic instrumentation because
            // it can be noisy and expensive during startup
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
        }),
    ],
});

export default sdk;
