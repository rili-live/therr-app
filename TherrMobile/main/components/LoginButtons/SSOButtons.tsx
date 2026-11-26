import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import AppleSignInButton from './AppleSignInButton';
import GoogleSignInButton from './GoogleSignInButton';
import OrDivider from '../Input/OrDivider';

interface ISSOButtonsProps {
    disabled: boolean;
    /**
     * `signIn` reads "Sign in with Google"; `continue` reads "Continue with Google" and is
     * what the sign-up screen uses, because the same tap creates the account if there is none.
     */
    intent: 'signIn' | 'continue';
    onLoginError: Function;
    onLoginSuccess: Function;
    /** Renders the "or" divider *below* the buttons, for when they lead the screen. */
    hasTrailingDivider?: boolean;
    translate: (key: string, params?: any) => string;
    themeAuthForm: {
        styles: any;
    };
    themeForms: {
        styles: any;
    };
}

/**
 * Google (and, on iOS, Apple) sign-in, laid out as one block.
 *
 * These lead the auth screens rather than trailing them: one tap with an account the user
 * already has is the shortest way in, and placed under a full manual form it was easy to miss
 * entirely — new users asked for "Google sign-in" while it sat below the fold.
 */
const SSOButtons = ({
    disabled,
    intent,
    onLoginError,
    onLoginSuccess,
    hasTrailingDivider = false,
    translate,
    themeAuthForm,
    themeForms,
}: ISSOButtonsProps) => (
    <>
        <View style={themeAuthForm.styles.submitButtonContainer}>
            <GoogleSignInButton
                disabled={disabled}
                buttonTitle={translate(intent === 'signIn'
                    ? 'forms.loginForm.sso.googleButtonTitleSignIn'
                    : 'forms.loginForm.sso.googleButtonTitleContinue')}
                onLoginError={onLoginError}
                onLoginSuccess={onLoginSuccess}
                themeForms={themeForms}
            />
        </View>
        {
            Platform.OS === 'ios' && appleAuth.isSupported &&
            <View style={themeAuthForm.styles.submitButtonContainer}>
                <AppleSignInButton
                    disabled={disabled}
                    buttonTitle={translate('forms.loginForm.sso.appleButtonTitle')}
                    onLoginError={onLoginError}
                    onLoginSuccess={onLoginSuccess}
                    themeForms={themeForms}
                    type={intent === 'signIn' ? AppleButton.Type.SIGN_IN : AppleButton.Type.CONTINUE}
                />
            </View>
        }
        {
            hasTrailingDivider
                ? (
                    <OrDivider
                        translate={translate}
                        themeForms={themeForms}
                        containerStyle={localStyles.trailingDivider}
                    />
                )
                : null
        }
    </>
);

const localStyles = StyleSheet.create({
    trailingDivider: {
        marginBottom: 20,
    },
});

export default SSOButtons;
