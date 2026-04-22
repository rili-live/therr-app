import React, { useState } from 'react';
import { Button } from '../BaseButton';
import { Image } from '../BaseImage';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const googleLogoImg = require('../../assets/google-letter-logo.png');

interface IGoogleSignInButtonProps {
    buttonTitle: string;
    onLoginError: Function;
    onLoginSuccess: Function;
    disabled: boolean;
    themeForms: {
        styles: any;
    }
}

async function onGoogleButtonPress({
    onLoginError,
    onLoginSuccess,
    setDisabled,
}) {
    setDisabled(true);

    // Debug: Log current Google Sign-In configuration
    console.log('[GoogleSignIn] Starting sign-in flow...');
    try {
        const currentUser = await GoogleSignin.getCurrentUser();
        console.log('[GoogleSignIn] Current user before sign-in:', currentUser ? currentUser.data?.user?.email : 'none');
    } catch (e) {
        console.log('[GoogleSignIn] Could not get current user:', e?.message);
    }

    // Get the users ID token
    let idToken;
    try {
        console.log('[GoogleSignIn] Calling GoogleSignin.signIn()...');
        const response = await GoogleSignin.signIn();
        console.log('[GoogleSignIn] signIn response type:', response.type);
        if (response.type === 'cancelled') {
            console.log('[GoogleSignIn] User cancelled sign-in');
            setDisabled(false);
            return;
        }
        idToken = response.data.idToken;
        console.log('[GoogleSignIn] Got idToken:', idToken ? `${idToken.substring(0, 20)}...` : 'NULL');
        console.log('[GoogleSignIn] User email:', response.data?.user?.email);
        console.log('[GoogleSignIn] User id:', response.data?.user?.id);
    } catch (error) {
        console.error('[GoogleSignIn] signIn() error:', JSON.stringify({
            message: error?.message,
            code: error?.code,
            name: error?.name,
        }));
        onLoginError(error);
        setDisabled(false);
        return;
    }

    // Create a Google credential with the token
    console.log('[GoogleSignIn] Creating Firebase credential with idToken...');
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    console.log('[GoogleSignIn] Firebase credential created, providerId:', googleCredential.providerId);

    // TODO: Call auth().signOut() when user signs or token expires
    // Sign-in the user with the credential
    console.log('[GoogleSignIn] Calling auth().signInWithCredential()...');
    return auth().signInWithCredential(googleCredential)
        .then((userCredential) => {
            console.log('[GoogleSignIn] Firebase signInWithCredential SUCCESS');
            console.log('[GoogleSignIn] Firebase user email:', userCredential.user?.email);
            console.log('[GoogleSignIn] Firebase user uid:', userCredential.user?.uid);
            console.log('[GoogleSignIn] additionalUserInfo provider:', userCredential?.additionalUserInfo?.providerId);
            onLoginSuccess(idToken, userCredential.user, userCredential?.additionalUserInfo?.profile, 'google');
        })
        .catch((err) => {
            console.error('[GoogleSignIn] Firebase signInWithCredential FAILED');
            console.error('[GoogleSignIn] Error code:', err?.code);
            console.error('[GoogleSignIn] Error message:', err?.message);
            console.error('[GoogleSignIn] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            onLoginError(err);
        })
        .finally(() => {
            setDisabled(false);
        });
}

function GoogleSignInButton({
    buttonTitle,
    onLoginError,
    onLoginSuccess,
    disabled,
    themeForms,
}: IGoogleSignInButtonProps) {
    const [isDisabled, setDisabled] = useState(false);

    return (
        <Button
            title={buttonTitle}
            onPress={() => onGoogleButtonPress({
                onLoginError,
                onLoginSuccess,
                setDisabled,
            })}
            disabled={disabled || isDisabled}
            // raised={true}
            containerStyle={themeForms.styles.googleButtonContainer}
            buttonStyle={themeForms.styles.googleButton}
            disabledStyle={themeForms.styles.buttonDisabled}
            titleStyle={themeForms.styles.googleButtonTitle}
            disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
            icon={
                <Image
                    source={googleLogoImg}
                    style={themeForms.styles.googleButtonIcon}
                />}
        />
    );
}

export default GoogleSignInButton;
