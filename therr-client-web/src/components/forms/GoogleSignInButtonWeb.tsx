import * as React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface IGoogleSignInButtonWebProps {
    onSuccess: (ssoData: {
        isSSO: boolean;
        idToken: string;
        ssoProvider: string;
        userFirstName: string;
        userLastName: string;
        userEmail: string;
    }) => void;
    onError: (message: string) => void;
    buttonText: 'signin_with' | 'signup_with';
    translate: (key: string, params?: any) => string;
}

const GoogleSignInButtonWeb: React.FC<IGoogleSignInButtonWebProps> = ({
    onSuccess,
    onError,
    buttonText,
    translate,
}) => {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleSuccess = (credentialResponse: CredentialResponse) => {
        console.log('[GoogleSSO] credentialResponse received', { // eslint-disable-line no-console
            hasCredential: !!credentialResponse.credential,
            clientId: credentialResponse.clientId,
            selectBy: credentialResponse.select_by,
        });
        const { credential } = credentialResponse;
        if (!credential) {
            console.warn('[GoogleSSO] No credential in response'); // eslint-disable-line no-console
            onError(translate('components.loginForm.sso.googleError'));
            return;
        }

        try {
            const payloadBase64 = credential.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64));
            const ssoData = {
                isSSO: true,
                idToken: credential,
                ssoProvider: 'google',
                userFirstName: payload.given_name || '',
                userLastName: payload.family_name || '',
                userEmail: payload.email || '',
            };
            console.log('[GoogleSSO] Calling onSuccess with ssoData', { // eslint-disable-line no-console
                ...ssoData,
                idToken: `${ssoData.idToken.substring(0, 20)}...`,
            });
            onSuccess(ssoData);
        } catch (err) {
            console.error('[GoogleSSO] Failed to decode JWT', err); // eslint-disable-line no-console
            onError(translate('components.loginForm.sso.googleError'));
        }
    };

    const handleError = () => {
        console.error('[GoogleSSO] GoogleLogin onError callback fired'); // eslint-disable-line no-console
        onError(translate('components.loginForm.sso.googleError'));
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div className="google-signin-button-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                text={buttonText}
                width="300"
            />
        </div>
    );
};

export default GoogleSignInButtonWeb;
