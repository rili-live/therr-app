import React, { useState } from 'react';
import auth from '@react-native-firebase/auth';
import { appleAuth, AppleButton, AppleButtonType } from '@invertase/react-native-apple-authentication';

interface IAppleSignInButtonProps {
    buttonTitle: string;
    onLoginError: Function;
    onLoginSuccess: Function;
    disabled: boolean;
    themeForms: {
        styles: any;
    },
    type: AppleButtonType | undefined;
}

async function onAppleButtonPress({
    onLoginError,
    onLoginSuccess,
    setDisabled,
}) {
    setDisabled(true);
    // Get the users ID token
    let idToken;
    let appleNonce;
    try {
        const { identityToken, nonce } = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        });
        idToken = identityToken;
        appleNonce = nonce;
    } catch (error) {
        onLoginError(error);
        setDisabled(false);
        return;
    }

    if (idToken) {
        // Create a Apple credential with the token
        const appleCredential = auth.AppleAuthProvider.credential(idToken, appleNonce);

        // TODO: Call auth().signOut() when user signs or token expires
        // Sign-in the user with the credential
        return auth().signInWithCredential(appleCredential)
            .then((userCredential) => {
                onLoginSuccess(idToken, userCredential.user, userCredential?.additionalUserInfo?.profile, 'apple');
            })
            .catch((err) => {
                onLoginError(err);
            })
            .finally(() => {
                setDisabled(false);
            });
    } else {
        console.warn('Apple login identityToken is undefined');
    }
}

function AppleSignInButton({
    onLoginError,
    onLoginSuccess,
    themeForms,
    type,
}: IAppleSignInButtonProps) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isDisabled, setDisabled] = useState(false);

    return (
        <AppleButton
            cornerRadius={3}
            onPress={() => onAppleButtonPress({
                onLoginError,
                onLoginSuccess,
                setDisabled,
            })}
            buttonStyle={AppleButton.Style.WHITE}
            buttonType={type}
            style={themeForms.styles.appleButtonContainer}
            textStyle={themeForms.styles.appleTitleStyle}
        />
    );
}

export default AppleSignInButton;
