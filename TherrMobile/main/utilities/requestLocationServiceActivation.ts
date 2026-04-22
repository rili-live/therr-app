import { Linking, Platform } from 'react-native';

interface IRequestLocationServiceActivationConfig {
    isGpsEnabled: Boolean;
    translate: Function;
    shouldIgnoreRequirement?: Boolean;
}

// On Android, when GPS is disabled, deep-link the user to the system
// Location Source Settings page. The `locationProviderStatusChange` listener
// in Layout.tsx picks up the new GPS state on return and updates Redux.
// Callers previously received `{ status, alreadyEnabled }` from the old
// native dialog; we preserve that shape for backward compatibility.
export default ({
    isGpsEnabled,
    shouldIgnoreRequirement,
}: IRequestLocationServiceActivationConfig): Promise<any> => {
    if (Platform.OS === 'ios') {
        return Promise.resolve({ status: null, alreadyEnabled: false });
    }

    if (isGpsEnabled) {
        return Promise.resolve({ status: 'enabled', alreadyEnabled: true });
    }

    return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
        .then(() => ({ status: 'pending', alreadyEnabled: false }))
        .catch((error) => {
            if (!shouldIgnoreRequirement) {
                throw error;
            }
            return { status: null, alreadyEnabled: false };
        });
};
