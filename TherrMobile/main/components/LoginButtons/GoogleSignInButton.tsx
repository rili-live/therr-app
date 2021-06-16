import React from 'react';
import { Button, Image } from 'react-native-elements';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import getConfig from '../../utilities/getConfig';

const googleLogoImg = require('../../assets/google-letter-logo.png');

GoogleSignin.configure({
    webClientId: getConfig().googleOAuth2WebClientId,
});

interface IGoogleSignInButtonProps {
    buttonTitle: string;
    onLoginError: Function;
    onLoginSuccess: Function;
}

async function onGoogleButtonPress({
    onLoginError,
    onLoginSuccess,
}) {
    // Get the users ID token
    const { idToken } = await GoogleSignin.signIn();

    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // Sign-in the user with the credential
    return auth().signInWithCredential(googleCredential)
        .then((userCredential) => {
            onLoginSuccess(idToken, userCredential.user, userCredential?.additionalUserInfo?.profile);
        })
        .catch((err) => {
            onLoginError(err);
        });
}

function GoogleSignInButton({
    buttonTitle,
    onLoginError,
    onLoginSuccess,
}: IGoogleSignInButtonProps) {
    return (
        <Button
            title={buttonTitle}
            onPress={() => onGoogleButtonPress({
                onLoginError,
                onLoginSuccess,
            })}
            raised={true}
            containerStyle={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
            }}
            buttonStyle={{
                backgroundColor: '#FFFFFF',
                flex: 1,
                width: '100%',
            }}
            titleStyle={{
                color: '#6b6969',
                fontSize: 16,
                textAlign: 'left',
                paddingLeft: 12,
                paddingRight: 12,
                fontWeight: 'bold',
            }}
            icon={
                <Image
                    source={googleLogoImg}
                    style={{
                        height: 22,
                        width: 22,
                        padding: 8,
                    }}
                />}
        />
    );
};

export default GoogleSignInButton;
